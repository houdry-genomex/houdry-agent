/**
 * Air-gap proof: a visible, in-app record of every outbound HTTP(S) request
 * any Electron session in this process has attempted, classified as
 * "local" (loopback / private LAN / the configured Houdry fabric host) or
 * "external" (anything else — the thing a sovereign/air-gapped deployment
 * must never produce).
 *
 * This does NOT block or modify requests. It only observes via
 * `webRequest.onBeforeRequest`, which fires for renderer fetch/XHR traffic
 * and for Electron's `net.request` calls made against the same session.
 * Raw Node `http`/`https` calls (e.g. the desktop's loopback backend
 * transport in api-transport.ts) don't ride an Electron session and so
 * aren't observed here — by construction those calls are the desktop
 * talking to its own local backend, never to the outside world.
 */

export type NetworkActivityClass = 'local' | 'external'

export interface NetworkActivityEntry {
  id: number
  ts: number
  method: string
  url: string
  host: string
  resourceType: string
  sessionLabel: string
  cls: NetworkActivityClass
}

const LOCAL_HOST_RE = /(^|\.)(localhost|local)$/i

const IPV4_PRIVATE_RE =
  /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/

/** Extra hostnames/IPs to treat as "local" — e.g. the LAN Houdry fabric host. */
export function isLocalHost(hostname: string, extraLocalHosts: readonly string[] = []): boolean {
  const host = (hostname || '').toLowerCase().replace(/^\[|\]$/g, '')

  if (!host) {
    return true // unresolved/relative — never treat as proof of an external call
  }

  if (host === '0.0.0.0' || host === '::1' || host === 'localhost') {
    return true
  }

  if (LOCAL_HOST_RE.test(host) || IPV4_PRIVATE_RE.test(host)) {
    return true
  }

  return extraLocalHosts.some(candidate => candidate && candidate.toLowerCase() === host)
}

export function classifyUrl(url: string, extraLocalHosts: readonly string[] = []): { host: string; cls: NetworkActivityClass } {
  try {
    const parsed = new URL(url)

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
      return { host: parsed.hostname || url, cls: 'local' } // file:, devtools:, chrome-extension:, data: — not network egress
    }

    const host = parsed.hostname

    return { host, cls: isLocalHost(host, extraLocalHosts) ? 'local' : 'external' }
  } catch {
    return { host: url, cls: 'local' }
  }
}

/** Fixed-capacity ring buffer of recent outbound requests, newest first. */
export class NetworkActivityLog {
  private entries: NetworkActivityEntry[] = []
  private nextId = 1
  private readonly capacity: number
  private readonly extraLocalHosts: readonly string[]

  constructor(options: { capacity?: number; extraLocalHosts?: readonly string[] } = {}) {
    this.capacity = options.capacity ?? 500
    this.extraLocalHosts = options.extraLocalHosts ?? []
  }

  record(input: { method: string; url: string; resourceType?: string; sessionLabel?: string }): NetworkActivityEntry {
    const { host, cls } = classifyUrl(input.url, this.extraLocalHosts)

    const entry: NetworkActivityEntry = {
      cls,
      host,
      id: this.nextId++,
      method: input.method || 'GET',
      resourceType: input.resourceType || 'other',
      sessionLabel: input.sessionLabel || 'default',
      ts: Date.now(),
      url: input.url
    }

    this.entries.unshift(entry)

    if (this.entries.length > this.capacity) {
      this.entries.length = this.capacity
    }

    return entry
  }

  list(): NetworkActivityEntry[] {
    return this.entries.slice()
  }

  externalCount(): number {
    return this.entries.reduce((count, entry) => (entry.cls === 'external' ? count + 1 : count), 0)
  }

  clear(): void {
    this.entries = []
  }
}

/**
 * Attach a non-blocking observer to a session's webRequest pipeline. Safe to
 * call multiple times on distinct sessions with the same log instance; each
 * session gets its own listener, all feeding the shared ring buffer.
 */
export function observeSessionNetworkActivity(
  electronSession: { webRequest: { onBeforeRequest: (fn: (details: any, callback: (response: { cancel: boolean }) => void) => void) => void } } | null | undefined,
  log: NetworkActivityLog,
  sessionLabel: string
): void {
  if (!electronSession || typeof electronSession.webRequest?.onBeforeRequest !== 'function') {
    return
  }

  electronSession.webRequest.onBeforeRequest((details, callback) => {
    try {
      log.record({
        method: details.method,
        resourceType: details.resourceType,
        sessionLabel,
        url: details.url
      })
    } catch {
      // Observation must never break the request it's watching.
    }

    callback({ cancel: false })
  })
}
