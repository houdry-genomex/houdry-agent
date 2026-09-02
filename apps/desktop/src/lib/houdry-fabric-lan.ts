import type { DesktopHoudryFabricEndpoint } from '@/global'

export type FabricLanSource = 'this-computer' | 'wifi'

export type FabricLanEndpoint = {
  api: string
  auth: boolean
  host: string
  name: string
  source: FabricLanSource
}

export type FabricLanKind = 'many' | 'none' | 'one'

export function fabricHost(api: string): string {
  try {
    return new URL(api).host
  } catch {
    return api
  }
}

export function uniqueFabricLan(list: FabricLanEndpoint[]): FabricLanEndpoint[] {
  const seen = new Set<string>()
  const seenName = new Map<string, number>()
  const out: FabricLanEndpoint[] = []

  for (const ep of list) {
    if (seen.has(ep.api)) {
      continue
    }

    seen.add(ep.api)

    const name = ep.name.trim()

    if (name) {
      const existing = seenName.get(name)

      if (existing !== undefined) {
        if (lanEndpointScore(ep) > lanEndpointScore(out[existing])) {
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

function lanEndpointScore(ep: FabricLanEndpoint): number {
  // Agent on this machine must use 127.0.0.1, not the WiFi/WSL address of
  // the same houdry serve process.
  if (ep.source === 'this-computer') {
    return 100
  }

  return lanHostScore(ep.host)
}

function lanHostScore(host: string): number {
  const hostname = host.includes('://') ? host : `http://${host}`

  try {
    return lanAddressScoreFromHost(new URL(hostname).hostname)
  } catch {
    return lanAddressScoreFromHost(host.split(':')[0] ?? host)
  }
}

function lanAddressScoreFromHost(hostname: string): number {
  const parts = hostname.split('.').map(Number)

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

export function fabricLanKind(count: number): FabricLanKind {
  if (count <= 0) {
    return 'none'
  }

  return count === 1 ? 'one' : 'many'
}

export function fromWifiAdvertise(ep: DesktopHoudryFabricEndpoint): FabricLanEndpoint {
  return {
    api: ep.api,
    auth: Boolean(ep.auth),
    host: fabricHost(ep.api),
    name: ep.name.trim(),
    source: 'wifi'
  }
}

export function fromLoopbackHit(baseUrl: string): FabricLanEndpoint {
  return {
    api: baseUrl,
    auth: false,
    host: fabricHost(baseUrl),
    name: '',
    source: 'this-computer'
  }
}

/**
 * Agent talks to houdry serve on this computer via 127.0.0.1. WiFi ads of the
 * same process (WiFi IP, WSL/Hyper-V) must not win — they look like a second
 * control plane and often fail from the desktop app.
 */
export function mergeFabricLanScan(
  wifi: FabricLanEndpoint[],
  loopbackApi: string | null | undefined
): FabricLanEndpoint[] {
  const local = loopbackApi?.trim()

  if (local) {
    return [fromLoopbackHit(local)]
  }

  return uniqueFabricLan(wifi)
}

/** Auto-fill only an empty field or the placeholder — never something the user typed. */
export function shouldAdoptDiscoveredUrl(current: string, placeholder: string): boolean {
  const trimmed = current.trim()

  return !trimmed || trimmed === placeholder
}

export function displayNameFor(ep: FabricLanEndpoint, thisComputer: string): string {
  if (ep.source === 'this-computer') {
    return thisComputer
  }

  return ep.name || ep.host
}
