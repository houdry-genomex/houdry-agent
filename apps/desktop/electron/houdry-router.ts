import type { ChildProcess } from 'node:child_process'
import path from 'node:path'

/**
 * Supervises the Houdry fabric — the local Go router that serves the
 * OpenAI-compatible /v1 surface the app talks to by default.
 *
 * The fabric is what makes this install self-contained: it routes each turn to
 * a model already on the machine and runs the drawing → STEP CAD pipeline, so
 * no request leaves the box. Requiring the user to start it in a second
 * terminal would make a fresh clone look broken, so the app starts it.
 *
 * Dependency-free by design (no `electron` import, all effects injected) so it
 * can be unit tested the way its siblings are.
 */

export const HOUDRY_ROUTER_PORT = 18_080
export const HOUDRY_ROUTER_ADDR = `127.0.0.1:${HOUDRY_ROUTER_PORT}`
export const HOUDRY_ROUTER_BASE_URL = `http://${HOUDRY_ROUTER_ADDR}/v1`

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
 * True when something already answers on the fabric port.
 *
 * Checked before spawning so a fabric the user started by hand — or one left
 * by a previous window — is adopted instead of fighting it for the port. The
 * probe hits a real endpoint rather than just opening a socket, so an
 * unrelated process squatting on 18080 is not mistaken for the fabric.
 */
export async function isRouterListening(
  fetchImpl: typeof fetch = fetch,
  baseUrl: string = HOUDRY_ROUTER_BASE_URL
): Promise<boolean> {
  try {
    const response = await fetchImpl(`${baseUrl}/models`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    })

    return response.ok
  } catch {
    return false
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

  if (await isRouterListening(fetchImpl)) {
    log('[houdry-router] already listening on ' + HOUDRY_ROUTER_ADDR + '; adopting it')

    return { child: null, ready: true }
  }

  if (!binary) {
    log('[houdry-router] binary not found; local inference is unavailable until it is installed')

    return { child: null, ready: false }
  }

  log(`[houdry-router] starting ${binary}`)

  let child: ChildProcess

  try {
    child = spawnImpl(binary, ['route', '--web', '--addr', HOUDRY_ROUTER_ADDR])
  } catch (cause) {
    log(`[houdry-router] spawn failed: ${cause instanceof Error ? cause.message : String(cause)}`)

    return { child: null, ready: false }
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

  while (now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      log('[houdry-router] exited before becoming ready; see the lines above')

      return { child: null, ready: false }
    }

    if (await isRouterListening(fetchImpl)) {
      log(`[houdry-router] ready on ${HOUDRY_ROUTER_ADDR}`)

      return { child, ready: true }
    }

    await sleep(READY_POLL_MS)
  }

  // Hand the child back even on timeout: it is still ours to kill on quit, and
  // it may well come up a moment later.
  log(`[houdry-router] did not become ready within ${READY_TIMEOUT_MS}ms`)

  return { child, ready: false }
}
