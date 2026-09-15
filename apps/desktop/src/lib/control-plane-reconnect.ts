import { isAzureInferenceSlug, isHoudryFabricSlug } from '@/lib/houdry-inference-providers'

export type SavedInference = {
  baseUrl: string
  provider: string
}

export type ReconnectDecision =
  | { action: 'adopt'; api: string }
  | { action: 'keep'; api: string }
  | { action: 'retry' }
  | { action: 'skip' }

export function normalizeFabricApi(api: string): string {
  const trimmed = api.trim()

  try {
    const url = new URL(trimmed)
    const origin = `${url.protocol}//${url.host}`
    const path = url.pathname.replace(/\/+$/, '')

    if (path === '' || path === '/') {
      return `${origin}/v1`
    }

    return `${origin}${path}`
  } catch {
    return trimmed.replace(/\/+$/, '')
  }
}

export function sameFabricApi(a: string, b: string): boolean {
  return normalizeFabricApi(a) === normalizeFabricApi(b)
}

export function fabricApiOrigin(api: string): string | null {
  try {
    const url = new URL(api.trim())

    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

export function savedInferenceFromConfig(cfg: Record<string, unknown>): SavedInference | null {
  const model = cfg.model

  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    return null
  }

  const rec = model as Record<string, unknown>
  const provider = typeof rec.provider === 'string' ? rec.provider.trim() : ''
  let baseUrl = typeof rec.base_url === 'string' ? rec.base_url.trim() : ''

  if (!baseUrl && provider) {
    baseUrl = providerRowBaseUrl(cfg, provider)
  }

  if (!provider && !baseUrl) {
    return null
  }

  return { baseUrl, provider }
}

function providerRowBaseUrl(cfg: Record<string, unknown>, provider: string): string {
  const providers = cfg.providers

  if (!providers || typeof providers !== 'object' || Array.isArray(providers)) {
    return ''
  }

  const row = (providers as Record<string, unknown>)[provider]

  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return ''
  }

  const url = (row as Record<string, unknown>).base_url

  return typeof url === 'string' ? url.trim() : ''
}

/** Azure stays put. Fabric is custom/houdry, or any http:// LAN URL (named providers). */
export function isFabricInstall(saved: SavedInference | null): boolean {
  if (!saved) {
    return false
  }

  if (isAzureInferenceSlug(saved.provider)) {
    return false
  }

  if (isHoudryFabricSlug(saved.provider)) {
    return true
  }

  return saved.baseUrl.toLowerCase().startsWith('http://')
}

export function decideFabricReconnect(input: {
  configured: boolean | null
  discoveredApi: string | null
  saved: SavedInference | null
  savedLoaded: boolean
  savedReachable: boolean
}): ReconnectDecision {
  if (input.configured === true) {
    if (!input.savedLoaded) {
      return { action: 'retry' }
    }

    if (input.saved && !isFabricInstall(input.saved)) {
      return { action: 'skip' }
    }

    if (!input.saved) {
      return { action: 'retry' }
    }

    const savedApi = input.saved?.baseUrl.trim() ?? ''

    if (input.savedReachable && savedApi) {
      return { action: 'keep', api: normalizeFabricApi(savedApi) }
    }

    if (input.discoveredApi) {
      return { action: 'adopt', api: normalizeFabricApi(input.discoveredApi) }
    }

    return { action: 'retry' }
  }

  if (input.discoveredApi) {
    return { action: 'adopt', api: normalizeFabricApi(input.discoveredApi) }
  }

  return { action: 'retry' }
}
