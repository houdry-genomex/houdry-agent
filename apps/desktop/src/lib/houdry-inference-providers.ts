/**
 * Houdry Agent Desktop inference is Azure OpenAI (DEV) or Houdry GPU fabric
 * (PROD). Other Houdry vendors stay in the Python catalog for CLI/gateway
 * compatibility; they must not appear in Desktop Settings, onboarding, the
 * API-key picker, or the composer model menu.
 */

const AZURE_SLUGS = new Set(['azure', 'azure-foundry', 'azure-openai', 'azure_openai', 'azure-ai'])

const FABRIC_SLUGS = new Set(['custom', 'houdry', 'houdry-fabric', 'fabric', 'local'])

export const HOUDRY_AZURE_DEFAULT_MODEL = 'gpt-5.6-luna'

/** Azure /models often lists these first; they are not the Houdry DEV deployment. */
const WEAK_AZURE_DEFAULTS = new Set(['gpt-3.5-turbo', 'gpt-35-turbo', 'gpt-3.5-turbo-16k', 'gpt-35-turbo-16k'])

const FOREIGN_AZURE_CHAT =
  /claude|anthropic|gemini|llama|mistral|deepseek|qwen|grok|nemotron|opencode|hy3|laguna|muse[-_]?spark|(?<![a-z])opus(?![a-z])|sonnet|haiku/i

export function isAzureInferenceSlug(slug: string): boolean {
  return AZURE_SLUGS.has(slug.trim().toLowerCase())
}

export function isHoudryFabricSlug(slug: string): boolean {
  const id = slug.trim().toLowerCase()

  return FABRIC_SLUGS.has(id) || id.startsWith('custom:')
}

export function isHoudryDesktopInferenceSlug(slug: string): boolean {
  return isAzureInferenceSlug(slug) || isHoudryFabricSlug(slug)
}

export function isHoudryDesktopInferenceEnvKey(key: string): boolean {
  return key.startsWith('AZURE_OPENAI_') || key.startsWith('AZURE_FOUNDRY_')
}

export function isHoudryDesktopInferenceGroupName(name: string): boolean {
  const n = name.trim().toLowerCase()

  return n.includes('azure') || n.includes('houdry')
}

export function azureOpenAiModelBaseId(model: string): string {
  const trimmed = model.trim()
  const slash = trimmed.lastIndexOf('/')

  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed
}

export function isAzureOpenAiChatModel(model: string): boolean {
  const base = azureOpenAiModelBaseId(model)

  if (!base) {
    return false
  }

  const lowered = base.toLowerCase()

  if (lowered.startsWith('gpt-') || lowered.startsWith('o1') || lowered.startsWith('o3') || lowered.startsWith('o4')) {
    return true
  }

  return !FOREIGN_AZURE_CHAT.test(lowered)
}

export function isWeakAzureDefaultModel(model: string): boolean {
  return WEAK_AZURE_DEFAULTS.has(azureOpenAiModelBaseId(model).toLowerCase())
}

export function isHoudryDesktopInferenceProvider(provider: {
  is_user_defined?: boolean
  slug: string
}): boolean {
  if (isHoudryDesktopInferenceSlug(provider.slug)) {
    return true
  }

  // User-defined OpenAI-compatible rows are the fabric / custom-endpoint path.
  return Boolean(provider.is_user_defined)
}

export function filterHoudryDesktopInferenceProviders<T extends { is_user_defined?: boolean; slug: string }>(
  providers: readonly T[]
): T[] {
  return providers.filter(isHoudryDesktopInferenceProvider)
}

function sanitizeAzureProviderModels<T extends { models?: readonly string[]; slug: string }>(provider: T): T {
  if (!isAzureInferenceSlug(provider.slug) || !provider.models) {
    return provider
  }

  const kept = provider.models.filter(isAzureOpenAiChatModel)
  const rest = kept.filter(model => azureOpenAiModelBaseId(model) !== HOUDRY_AZURE_DEFAULT_MODEL)
  const models = [HOUDRY_AZURE_DEFAULT_MODEL, ...rest]

  return { ...provider, models }
}

export function scopeHoudryDesktopModelCatalog<
  T extends {
    model?: string
    provider?: string
    providers?: ReadonlyArray<{ is_user_defined?: boolean; models?: readonly string[]; slug: string }>
  }
>(options: T): T {
  if (!options.providers) {
    return options
  }

  const providers = filterHoudryDesktopInferenceProviders(options.providers).map(sanitizeAzureProviderModels)
  const provider = String(options.provider || '')
  let model = options.model

  if (isAzureInferenceSlug(provider) && model && (!isAzureOpenAiChatModel(model) || isWeakAzureDefaultModel(model))) {
    model = HOUDRY_AZURE_DEFAULT_MODEL
  }

  return {
    ...options,
    providers,
    ...(model !== undefined ? { model } : {})
  }
}
