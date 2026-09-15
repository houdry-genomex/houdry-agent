/**
 * Supervises the Houdry control plane — `houdry serve` — which is the only
 * OpenAI-compatible /v1 surface the app talks to.
 *
 * The fabric is what makes this install self-contained: with no GPU node it
 * routes each turn to Ollama on this machine and runs the drawing → STEP CAD
 * pipeline; with a READY GPU node it dispatches cluster jobs. Requiring the
 * user to start serve in a second terminal would make a fresh clone look
 * broken, so the app starts it.
 *
 * Dependency-free by design (no `electron` import, all effects injected) so it
 * can be unit tested the way its siblings are.
 */

import type { ChildProcess } from 'node:child_process'
import path from 'node:path'

import { isControlPlaneWellKnown, probeHoudryControlPlane } from './houdry-fabric-discover'

/** Keep in sync with FABRIC_LOOPBACK_PORTS in src/lib/local-inference-scan.ts */
export const HOUDRY_FABRIC_PORTS = [18_080, 8090, 8080] as const
export const HOUDRY_ROUTER_PORT = HOUDRY_FABRIC_PORTS[0]
export const HOUDRY_ROUTER_ADDR = `127.0.0.1:${HOUDRY_ROUTER_PORT}`
/** Bind all interfaces so GPU hosts on the same WiFi can join this plane. */
export const HOUDRY_ROUTER_LISTEN = `0.0.0.0:${HOUDRY_ROUTER_PORT}`
export const HOUDRY_ROUTER_BASE_URL = `http://${HOUDRY_ROUTER_ADDR}/v1`
export const HOUDRY_WELL_KNOWN_URL = `http://${HOUDRY_ROUTER_ADDR}/.well-known/houdry.json`

const READY_TIMEOUT_MS = 20_000
const READY_POLL_MS = 400
const PROBE_TIMEOUT_MS = 2_000

export interface ResolveBinaryOptions {
  appRoot: string
  /** `HOUDRY_ROUTER_BIN` — an explicit path wins over every search location. */
  envOverride?: string
  exists: (candidate: string) => boolean
  isPackaged: boolean
  platform: string
  /** Electron's `process.resourcesPath`; only meaningful when packaged. */
  resourcesPath?: string
  /** Monorepo root in dev, so a sibling checkout of the Go repo is usable. */
  sourceRepoRoot?: string
}

/**
 * Locate the fabric binary, or '' when it is not installed.
 *
 * Packaged builds ship it via electron-builder `extraResources`, which lands
 * outside the asar and so is directly executable.
 *
 * In dev a sibling `houdry` checkout is preferred over the vendored copy, and
 * the order matters: the fabric resolves its CAD pipeline and Python venv
 * relative to its own directory, and only a real checkout has the `.venv` that
 * `scripts/cad/setup.sh` builds. Running the vendored binary instead would
 * still chat fine but quietly degrade drawing → STEP to a Python without
 * cadquery.
 */
export function resolveHoudryBinary(options: ResolveBinaryOptions): string {
  const { appRoot, envOverride, exists, isPackaged, platform, resourcesPath, sourceRepoRoot } = options
  const exe = platform === 'win32' ? 'houdry.exe' : 'houdry'

  if (envOverride?.trim()) {
    const override = path.resolve(envOverride.trim())

    return exists(override) ? override : ''
  }

  const candidates = [
    isPackaged && resourcesPath ? path.join(resourcesPath, 'bin', exe) : '',
    sourceRepoRoot ? path.join(sourceRepoRoot, '..', 'houdry', exe) : '',
    path.join(appRoot, 'resources', 'bin', exe)
  ].filter(Boolean)

  return candidates.find(candidate => exists(candidate)) ?? ''
}

/**
 * True when houdry serve already answers on a known fabric port.
 *
 * Checked before spawning so a control plane the user started by hand — or
 * one left by a previous window — is adopted instead of fighting it for the
 * port. The probe hits `/.well-known/houdry.json`, so an unrelated process
 * squatting on 18080 (Cursor, WSL relay, a leftover bench) is not mistaken
 * for the fabric. 8090/8080 are tried next because those are the ports
 * `houdry serve` actually uses when 18080 is taken.
 */
export async function isRouterListening(
  fetchImpl: typeof fetch = fetch,
  wellKnownUrl: string = HOUDRY_WELL_KNOWN_URL
): Promise<boolean> {
  if (wellKnownUrl !== HOUDRY_WELL_KNOWN_URL) {
    const origin = wellKnownUrl.replace(/\/\.well-known\/houdry\.json$/, '')

    return probeHoudryControlPlane(origin, fetchImpl, PROBE_TIMEOUT_MS)
  }

  return (await findListeningFabricPort(fetchImpl)) !== null
}

export async function findListeningFabricPort(
  fetchImpl: typeof fetch = fetch,
  ports: readonly number[] = HOUDRY_FABRIC_PORTS
): Promise<number | null> {
  for (const port of ports) {
    if (await probeHoudryControlPlane(`http://127.0.0.1:${port}`, fetchImpl, PROBE_TIMEOUT_MS)) {
      return port
    }
  }

  return null
}

async function classifyLoopbackPort(
  port: number,
  fetchImpl: typeof fetch
): Promise<'busy' | 'fabric' | 'free'> {
  try {
    const response = await fetchImpl(`http://127.0.0.1:${port}/.well-known/houdry.json`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    })

    if (response.ok && isControlPlaneWellKnown(await response.json())) {
      return 'fabric'
    }

    return 'busy'
  } catch {
    return 'free'
  }
}

export interface StartRouterOptions {
  binary: string
  fetchImpl?: typeof fetch
  log: (line: string) => void
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  spawnImpl: (command: string, args: string[]) => ChildProcess
}

export interface StartRouterResult {
  /** null when an already-running fabric was adopted — nothing to tear down. */
  child: ChildProcess | null
  /** Loopback port the fabric is answering on. */
  port: number
  ready: boolean
}

/**
 * Start the fabric if it is not already up, and wait for it to answer.
 *
 * Never throws: the app is still usable against Azure, or against a fabric the
 * user starts later, so a failure here is logged and reported rather than
 * blocking startup.
 */
export async function startHoudryRouter(options: StartRouterOptions): Promise<StartRouterResult> {
  const {
    binary,
    fetchImpl = fetch,
    log,
    now = () => Date.now(),
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
    spawnImpl
  } = options

  const existing = await findListeningFabricPort(fetchImpl)

  if (existing !== null) {
    log(`[houdry-router] already listening on 127.0.0.1:${existing}; adopting it`)

    return { child: null, port: existing, ready: true }
  }

  if (!binary) {
    log('[houdry-router] binary not found; local inference is unavailable until it is installed')

    return { child: null, port: HOUDRY_ROUTER_PORT, ready: false }
  }

  let listenPort: number = HOUDRY_ROUTER_PORT

  for (const port of HOUDRY_FABRIC_PORTS) {
    const status = await classifyLoopbackPort(port, fetchImpl)

    if (status === 'free') {
      listenPort = port

      break
    }
  }

  log(`[houdry-router] starting ${binary} on 0.0.0.0:${listenPort}`)

  let child: ChildProcess

  try {
    child = spawnImpl(binary, ['serve', '--listen', `0.0.0.0:${listenPort}`])
  } catch (cause) {
    log(`[houdry-router] spawn failed: ${cause instanceof Error ? cause.message : String(cause)}`)

    return { child: null, port: listenPort, ready: false }
  }

  const relay = (chunk: unknown) => {
    const text = String(chunk).trimEnd()

    if (text) {
      log(`[houdry-router] ${text}`)
    }
  }

  child.stdout?.on('data', relay)
  child.stderr?.on('data', relay)
  child.once('error', cause => log(`[houdry-router] error: ${cause.message}`))
  child.once('exit', (code, signal) => log(`[houdry-router] exited (code=${code} signal=${signal})`))

  const deadline = now() + READY_TIMEOUT_MS
  const origin = `http://127.0.0.1:${listenPort}`

  while (now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      log('[houdry-router] exited before becoming ready; see the lines above')

      return { child: null, port: listenPort, ready: false }
    }

    if (await probeHoudryControlPlane(origin, fetchImpl, PROBE_TIMEOUT_MS)) {
      log(`[houdry-router] ready on 127.0.0.1:${listenPort}`)

      return { child, port: listenPort, ready: true }
    }

    await sleep(READY_POLL_MS)
  }

  // Hand the child back even on timeout: it is still ours to kill on quit, and
  // it may well come up a moment later.
  log(`[houdry-router] did not become ready within ${READY_TIMEOUT_MS}ms`)

  return { child, port: listenPort, ready: false }
}
