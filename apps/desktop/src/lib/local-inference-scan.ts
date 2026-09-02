/**
 * Automatic discovery of local (on-premise) inference servers.
 *
 * Houdry's whole premise is that inference runs on hardware the user already
 * owns, so the common case at first launch is "there is already an engine
 * listening on this machine and the user shouldn't have to know its port".
 * Rather than ask them to type a URL, we knock on the handful of ports the
 * mainstream local engines bind by default and adopt the first one that answers
 * with a model catalog.
 *
 * Probing is HTTP-only and goes through the same `/api/providers/validate`
 * round-trip the manual form uses. That matters more than it looks: it means
 * detection sees exactly what the runtime will see. A daemon whose models live
 * on another volume (OLLAMA_MODELS pointed at a second drive, say) is found
 * correctly, because we ask the running daemon what it serves instead of
 * guessing from a models directory on disk.
 *
 * Nothing here writes config. The caller decides what to do with a hit — the
 * onboarding form prefills it and still waits for an explicit Connect, so
 * "detected" never silently becomes "committed".
 */

/** A model server we know how to find, and what to call it when we do. */
export interface LocalInferenceCandidate {
  /** When true, a reachable empty catalog is still a hit (Houdry fabric). Only after identity is confirmed. */
  allowEmptyCatalog?: boolean
  /** OpenAI-compatible base URL, exactly as it would be persisted. */
  baseUrl: string
  /** Product name, shown verbatim — a proper noun, so it isn't translated. */
  label: string
}

export interface LocalInferenceHit extends LocalInferenceCandidate {
  /** Model ids the endpoint advertised, in the order it listed them. */
  models: string[]
}

/** The shape of `validateProviderCredential`, narrowed to what a scan needs. */
export type LocalInferenceProbe = (baseUrl: string) => Promise<{
  models?: string[]
  ok: boolean
  reachable: boolean
}>

/**
 * Ordered by preference, not by likelihood. The fabric comes first because when
 * it is up it is the endpoint that fronts every other engine on the box —
 * adopting a bare Ollama while the router is running would pin the app to one
 * backend and lose the routing. After that it is plain default-port order.
 *
 * 127.0.0.1 rather than localhost throughout: on Windows, `localhost` can
 * resolve to ::1 first and a server bound only to IPv4 then looks unreachable
 * for the length of a connect timeout.
 */
export const LOCAL_INFERENCE_CANDIDATES: readonly LocalInferenceCandidate[] = [
  { baseUrl: 'http://127.0.0.1:18080/v1', label: 'Houdry fabric', allowEmptyCatalog: true },
  { baseUrl: 'http://127.0.0.1:8090/v1', label: 'Houdry fabric', allowEmptyCatalog: true },
  { baseUrl: 'http://127.0.0.1:11434/v1', label: 'Ollama' },
  { baseUrl: 'http://127.0.0.1:1234/v1', label: 'LM Studio' },
  { baseUrl: 'http://127.0.0.1:8080/v1', label: 'llama.cpp' },
  { baseUrl: 'http://127.0.0.1:8000/v1', label: 'vLLM' }
]

/**
 * Loopback ports houdry serve actually binds. Keep in sync with
 * `HOUDRY_FABRIC_PORTS` in electron/houdry-router.ts.
 * Identity (`/.well-known/houdry.json`) is required — 8080/18080 are often
 * Cursor or llama.cpp, and 8090 is the usual fallback when those are taken.
 */
export const FABRIC_LOOPBACK_PORTS = [18_080, 8090, 8080] as const

export const FABRIC_LOOPBACK_CANDIDATES: readonly LocalInferenceCandidate[] = FABRIC_LOOPBACK_PORTS.map(port => ({
  baseUrl: `http://127.0.0.1:${port}/v1`,
  label: 'Houdry fabric',
  allowEmptyCatalog: true
}))

/** Confirm a loopback URL is houdry serve, not an unrelated process on that port. */
export type FabricIdentityProbe = (baseUrl: string) => Promise<boolean>

/**
 * Reachable is not the same as usable. A port that accepts a connection but
 * advertises nothing has no model to route to, and adopting it would produce a
 * configuration that saves cleanly and then fails on the first message.
 *
 * The fabric is the one exception: it is a router, so it answers `auto` and may
 * legitimately publish no catalog of its own.
 */
function hitFrom(candidate: LocalInferenceCandidate, result: Awaited<ReturnType<LocalInferenceProbe>>) {
  if (!result.reachable) {
    return null
  }

  const models = (result.models ?? []).filter(model => model.trim().length > 0)
  const hit = { baseUrl: candidate.baseUrl, label: candidate.label, models }

  if (models.length > 0) {
    return hit
  }

  return candidate.allowEmptyCatalog || /:(18080|8090)(?:\/|$)|houdry/i.test(candidate.baseUrl)
    ? { ...hit, models: ['auto'] }
    : null
}

/**
 * Knock on every candidate at once and return the most-preferred one that
 * answered, or null if none did.
 *
 * Concurrent rather than sequential: these are all loopback connects, so the
 * ones that are going to fail fail immediately (the OS refuses the connection),
 * and running them in parallel means the whole scan costs one round-trip
 * instead of five. We still resolve by candidate order, not by who replied
 * first, so a slow fabric doesn't lose to a fast Ollama.
 *
 * A probe that throws is treated as "not there". Detection is an assist; it must
 * never be able to fail the surface that hosts it, and the manual URL field is
 * always sitting right underneath as the fallback.
 */
export async function scanLocalInference(
  probe: LocalInferenceProbe,
  candidates: readonly LocalInferenceCandidate[] = LOCAL_INFERENCE_CANDIDATES
): Promise<LocalInferenceHit | null> {
  const results = await Promise.all(
    candidates.map(async candidate => {
      try {
        return hitFrom(candidate, await probe(candidate.baseUrl))
      } catch {
        return null
      }
    })
  )

  return results.find(hit => hit !== null) ?? null
}

/** Same as scanLocalInference, but only the loopback ports houdry serve uses.
 *  `isFabric` must confirm `/.well-known/houdry.json` — a port that merely
 *  answers HTTP (WSL, Cursor, llama.cpp on 8080) is not the control plane. */
export async function scanLocalFabric(
  probe: LocalInferenceProbe,
  isFabric: FabricIdentityProbe
): Promise<LocalInferenceHit | null> {
  const wrapped: LocalInferenceProbe = async baseUrl => {
    if (!(await isFabric(baseUrl))) {
      return { ok: false, reachable: false }
    }

    return probe(baseUrl)
  }

  return scanLocalInference(wrapped, FABRIC_LOOPBACK_CANDIDATES)
}

/** "Ollama · 127.0.0.1:11434 · 3 models" — the one-line summary of a hit. */
export function describeLocalInferenceHit(hit: LocalInferenceHit, modelsWord: string): string {
  let host = hit.baseUrl

  try {
    host = new URL(hit.baseUrl).host
  } catch {
    // Keep the raw string; a candidate URL we can't parse is still worth naming.
  }

  return `${hit.label} · ${host} · ${hit.models.length} ${modelsWord}`
}
