import dgram from 'node:dgram'
import { type NetworkInterfaceInfo, networkInterfaces } from 'node:os'

/** Keep in sync with houdry/internal/discovery (UDPPort). */
export const HOUDRY_FABRIC_UDP_PORT = 41808
export const HOUDRY_FABRIC_MULTICAST = '239.255.77.77'
export const HOUDRY_FABRIC_DISCOVER_WAIT_MS = 2_000

export type HoudryFabricEndpoint = {
  api: string
  auth: boolean
  name: string
  openai: boolean
  url: string
  version?: string
}

type UdpAdvertise = {
  auth?: boolean
  houdry?: string
  name?: string
  openai?: boolean
  path?: string
  url?: string
  v?: number
  version?: string
}

export function parseHoudryAdvertise(raw: string): HoudryFabricEndpoint | null {
  let msg: UdpAdvertise

  try {
    msg = JSON.parse(raw) as UdpAdvertise
  } catch {
    return null
  }

  if (msg.houdry !== 'control-plane' || msg.v !== 1 || !msg.url) {
    return null
  }

  const url = msg.url.replace(/\/+$/, '')
  const path = msg.path && msg.path.startsWith('/') ? msg.path : '/v1'

  return {
    name: msg.name?.trim() || '',
    url,
    api: `${url}${path}`,
    version: msg.version,
    auth: Boolean(msg.auth),
    openai: Boolean(msg.openai)
  }
}

export function isControlPlaneWellKnown(body: unknown): boolean {
  if (!body || typeof body !== 'object') {
    return false
  }

  const msg = body as { houdry?: unknown; v?: unknown }

  return msg.houdry === 'control-plane' && msg.v === 1
}

/**
 * True when `origin` serves GET /.well-known/houdry.json as a v1 control plane.
 * Used so loopback scans do not adopt Cursor, WSL relays, or other squatters.
 */
export async function probeHoudryControlPlane(
  origin: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = 2_000
): Promise<boolean> {
  let url: string

  try {
    url = `${new URL(origin).origin}/.well-known/houdry.json`
  } catch {
    return false
  }

  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) })

    if (!response.ok) {
      return false
    }

    return isControlPlaneWellKnown(await response.json())
  } catch {
    return false
  }
}

export function uniqueFabricEndpoints(
  list: HoudryFabricEndpoint[],
  ifaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces()
): HoudryFabricEndpoint[] {
  return uniqueFabricEndpointsOn(list, ifaces)
}

/** Rewrite ads whose IP is assigned to this computer to 127.0.0.1 so Agent
 *  never pins a WiFi/WSL address for a control plane running locally. */
export function preferLoopbackIfLocal(
  ep: HoudryFabricEndpoint,
  ifaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces()
): HoudryFabricEndpoint {
  let parsed: URL

  try {
    parsed = new URL(ep.url)
  } catch {
    return ep
  }

  const host = parsed.hostname
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80')

  if (host === '127.0.0.1' || host === 'localhost') {
    const url = `http://127.0.0.1:${port}`

    return { ...ep, url, api: `${url}/v1` }
  }

  if (!ipv4IsAssignedToThisHost(host, ifaces)) {
    return ep
  }

  const url = `http://127.0.0.1:${port}`

  return { ...ep, url, api: `${url}/v1` }
}

export function ipv4IsAssignedToThisHost(
  host: string,
  ifaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces()
): boolean {
  for (const addrs of Object.values(ifaces)) {
    if (!addrs) {
      continue
    }

    for (const addr of addrs) {
      const family = String(addr.family)

      if (family !== 'IPv4' && family !== '4') {
        continue
      }

      if (addr.address === host) {
        return true
      }
    }
  }

  return false
}

function uniqueFabricEndpointsOn(
  list: HoudryFabricEndpoint[],
  ifaces: NodeJS.Dict<NetworkInterfaceInfo[]>
): HoudryFabricEndpoint[] {
  const rewritten = list.map(ep => preferLoopbackIfLocal(ep, ifaces))
  const seenUrl = new Map<string, number>()
  const byUrl: HoudryFabricEndpoint[] = []

  for (const ep of rewritten) {
    const existing = seenUrl.get(ep.url)

    if (existing === undefined) {
      seenUrl.set(ep.url, byUrl.length)
      byUrl.push(ep)

      continue
    }

    if (!byUrl[existing].name && ep.name) {
      byUrl[existing] = { ...ep }
    }
  }

  // One serve process answers on every NIC (WiFi plus WSL/Hyper-V). Those
  // replies share the instance name and must not look like two control planes.
  const seenName = new Map<string, number>()
  const out: HoudryFabricEndpoint[] = []

  for (const ep of byUrl) {
    const name = ep.name.trim()

    if (name) {
      const existing = seenName.get(name)

      if (existing !== undefined) {
        if (lanAddressScore(ep.url) > lanAddressScore(out[existing].url)) {
          out[existing] = ep
        }

        continue
      }

      seenName.set(name, out.length)
    }

    out.push(ep)
  }

  return out
}

/** Higher is a better pick for "this WiFi": prefer 192.168 over WSL/Hyper-V 172.x.
 *  Loopback wins when the advertisement is this machine — Agent must not use a
 *  Hyper-V 172.x URL for a control plane that is already on 127.0.0.1. */
export function lanAddressScore(urlOrHost: string): number {
  let host = urlOrHost

  try {
    host = urlOrHost.includes('://') ? new URL(urlOrHost).hostname : urlOrHost.split(':')[0]
  } catch {
    return 5
  }

  const parts = host.split('.').map(Number)

  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) {
    return 5
  }

  const [a, b] = parts

  if (a === 127) {
    return 50
  }

  if (a === 192 && b === 168) {
    return 40
  }

  if (a === 10) {
    return 30
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return 10
  }

  if (a === 169 && b === 254) {
    return 0
  }

  return 20
}

/** Hyper-V/WSL/VM NICs are not the WiFi the user is picking a control plane on. */
export const VIRTUAL_IFACE_NAME =
  /vEthernet|WSL|Hyper-V|docker|VMware|VirtualBox|vboxnet|vmnet|ZeroTier|Hamachi/i

/** IPv4 directed broadcast for an address/netmask pair, or null if the pair is unusable. */
export function ipv4Broadcast(address: string, netmask: string): string | null {
  const ip = address.split('.').map(Number)
  const mask = netmask.split('.').map(Number)

  if (ip.length !== 4 || mask.length !== 4) {
    return null
  }

  if (ip.some(n => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null
  }

  if (mask.some(n => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null
  }

  return ip.map((octet, i) => octet | (~mask[i] & 255)).join('.')
}

export function udpBroadcastTargets(
  ifaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces()
): string[] {
  const out = ['255.255.255.255', HOUDRY_FABRIC_MULTICAST]
  const seen = new Set(out)

  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs || VIRTUAL_IFACE_NAME.test(name)) {
      continue
    }

    for (const addr of addrs) {
      const family = String(addr.family)

      if (addr.internal || (family !== 'IPv4' && family !== '4')) {
        continue
      }

      const bcast = ipv4Broadcast(addr.address, addr.netmask)

      if (!bcast || seen.has(bcast)) {
        continue
      }

      seen.add(bcast)
      out.push(bcast)
    }
  }

  return out
}

const PROBE = Buffer.from(JSON.stringify({ houdry: 'discover', v: 1 }))

/**
 * Probe the LAN for houdry serve advertisements. Never throws: a closed
 * firewall or guest-WiFi isolation just looks like "nothing found".
 */
export async function discoverHoudryFabric(
  waitMs: number = HOUDRY_FABRIC_DISCOVER_WAIT_MS
): Promise<HoudryFabricEndpoint[]> {
  try {
    return uniqueFabricEndpoints(await listenForAdvertise(waitMs))
  } catch {
    return []
  }
}

function listenForAdvertise(waitMs: number): Promise<HoudryFabricEndpoint[]> {
  return new Promise(resolve => {
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    const found: HoudryFabricEndpoint[] = []
    let settled = false

    const finish = () => {
      if (settled) {
        return
      }

      settled = true

      try {
        sock.close()
      } catch {
        // Already closed.
      }

      resolve(found)
    }

    sock.on('message', msg => {
      const ep = parseHoudryAdvertise(msg.toString('utf8'))

      if (ep) {
        found.push(ep)
      }
    })
    sock.on('error', () => finish())
    sock.bind(0, () => {
      try {
        sock.setBroadcast(true)
      } catch {
        finish()

        return
      }

      for (const ip of udpBroadcastTargets()) {
        sock.send(PROBE, HOUDRY_FABRIC_UDP_PORT, ip, () => {
          // Ignore per-target send errors (no route, interface down).
        })
      }
    })

    setTimeout(finish, Math.max(200, waitMs))
  })
}
