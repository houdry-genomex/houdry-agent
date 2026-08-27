import { describe, expect, it } from 'vitest'

import {
  filterHoudryDesktopInferenceProviders,
  isHoudryDesktopInferenceEnvKey,
  isHoudryDesktopInferenceGroupName,
  isHoudryDesktopInferenceSlug,
  scopeHoudryDesktopModelCatalog
} from './houdry-inference-providers'

describe('houdry desktop inference allowlist', () => {
  it('keeps Azure and Houdry fabric slugs only', () => {
    expect(isHoudryDesktopInferenceSlug('azure')).toBe(true)
    expect(isHoudryDesktopInferenceSlug('azure-foundry')).toBe(true)
    expect(isHoudryDesktopInferenceSlug('custom')).toBe(true)
    expect(isHoudryDesktopInferenceSlug('custom:lab')).toBe(true)
    expect(isHoudryDesktopInferenceSlug('houdry')).toBe(true)
    expect(isHoudryDesktopInferenceSlug('anthropic')).toBe(false)
    expect(isHoudryDesktopInferenceSlug('nous')).toBe(false)
    expect(isHoudryDesktopInferenceSlug('openrouter')).toBe(false)
    expect(isHoudryDesktopInferenceSlug('opencode-free')).toBe(false)
    expect(isHoudryDesktopInferenceSlug('opencode-zen')).toBe(false)
  })

  it('keeps only Azure env keys in the Settings Keys catalog', () => {
    expect(isHoudryDesktopInferenceEnvKey('AZURE_OPENAI_API_KEY')).toBe(true)
    expect(isHoudryDesktopInferenceEnvKey('AZURE_OPENAI_ENDPOINT')).toBe(true)
    expect(isHoudryDesktopInferenceEnvKey('AZURE_FOUNDRY_BASE_URL')).toBe(true)
    expect(isHoudryDesktopInferenceEnvKey('ANTHROPIC_API_KEY')).toBe(false)
    expect(isHoudryDesktopInferenceEnvKey('OPENAI_API_KEY')).toBe(false)
    expect(isHoudryDesktopInferenceEnvKey('FIREWORKS_API_KEY')).toBe(false)
  })

  it('matches Azure / Houdry group labels from the backend catalog', () => {
    expect(isHoudryDesktopInferenceGroupName('Azure OpenAI')).toBe(true)
    expect(isHoudryDesktopInferenceGroupName('Azure Foundry')).toBe(true)
    expect(isHoudryDesktopInferenceGroupName('WidgetAI')).toBe(false)
    expect(isHoudryDesktopInferenceGroupName('OpenRouter')).toBe(false)
  })

  it('drops third-party catalog rows and keeps user-defined fabric endpoints', () => {
    const filtered = filterHoudryDesktopInferenceProviders([
      { slug: 'azure', name: 'Azure' },
      { slug: 'anthropic', name: 'Anthropic' },
      { slug: 'local-ollama', name: 'Ollama', is_user_defined: true },
      { slug: 'opencode-free', name: 'OpenCode Free' },
      { slug: 'nous', name: 'Nous' }
    ])

    expect(filtered.map(p => p.slug)).toEqual(['azure', 'local-ollama'])
  })

  it('scopes a model.options payload down to Azure and fabric rows', () => {
    const scoped = scopeHoudryDesktopModelCatalog({
      model: 'x-preview-f-free',
      provider: 'opencode-free',
      providers: [
        { slug: 'opencode-free', name: 'OpenCode Free', models: ['x-preview-f-free'] },
        { slug: 'azure', name: 'Azure OpenAI', models: ['gpt-5.6-luna'] },
        { slug: 'custom', name: 'Houdry GPU fabric', models: ['auto'] }
      ]
    })

    expect(scoped.providers.map(p => p.slug)).toEqual(['azure', 'custom'])
  })

  it('replaces leftover Claude/OpenCode ids on Azure Foundry with gpt-5.6-luna', () => {
    const scoped = scopeHoudryDesktopModelCatalog({
      model: 'claude-opus-4.6',
      provider: 'azure-foundry',
      providers: [{ slug: 'azure-foundry', name: 'Azure Foundry', models: ['claude-opus-4.6'] }]
    })

    expect(scoped.model).toBe('gpt-5.6-luna')
    expect(scoped.providers[0].models).toEqual(['gpt-5.6-luna'])
  })

  it('pins gpt-5.6-luna ahead of Azure gpt-3.5-turbo leftovers', () => {
    const scoped = scopeHoudryDesktopModelCatalog({
      model: 'gpt-3.5-turbo',
      provider: 'azure-foundry',
      providers: [
        { slug: 'azure-foundry', name: 'Azure Foundry', models: ['gpt-3.5-turbo', 'gpt-5.6-luna', 'gpt-4o'] }
      ]
    })

    expect(scoped.model).toBe('gpt-5.6-luna')
    expect(scoped.providers[0].models[0]).toBe('gpt-5.6-luna')
    expect(scoped.providers[0].models).toContain('gpt-3.5-turbo')
  })
})
