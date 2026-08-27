import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { atom } from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EnvVarInfo } from '@/types/hermes'

const getEnvVars = vi.fn()
const startManualLocalEndpoint = vi.fn()
const onboarding = atom({ manual: false })

vi.mock('@/hermes', () => ({
  getEnvVars: () => getEnvVars()
}))

vi.mock('@/store/onboarding', () => ({
  $desktopOnboarding: onboarding,
  startManualLocalEndpoint: (reason: null | string) => startManualLocalEndpoint(reason)
}))

function keyVar(patch: Partial<EnvVarInfo> = {}): EnvVarInfo {
  return {
    advanced: false,
    category: 'provider',
    description: '',
    is_password: true,
    is_set: false,
    provider: '',
    provider_label: '',
    redacted_value: null,
    tools: [],
    url: '',
    ...patch
  }
}

beforeEach(() => {
  onboarding.set({ manual: false })
  getEnvVars.mockResolvedValue({})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('ProvidersSettings', () => {
  it('hides third-party backend-tagged providers from the Keys catalog', async () => {
    getEnvVars.mockResolvedValue({
      WIDGETAI_API_KEY: keyVar({
        provider: 'widgetai',
        provider_label: 'WidgetAI',
        url: 'https://widgetai.example/keys'
      }),
      ANTHROPIC_API_KEY: keyVar({
        provider: 'anthropic',
        provider_label: 'Anthropic'
      }),
      AZURE_OPENAI_API_KEY: keyVar({
        provider: 'azure',
        provider_label: 'Azure OpenAI'
      })
    })

    const { ProvidersSettings } = await import('./providers-settings')
    await act(async () => {
      render(<ProvidersSettings onClose={vi.fn()} onViewChange={vi.fn()} view="keys" />)
    })

    expect(await screen.findByText('Azure OpenAI')).toBeTruthy()
    expect(screen.queryByText('WidgetAI')).toBeNull()
    expect(screen.queryByText('Anthropic')).toBeNull()
  })

  it('does not list leftover third-party keys even when they are set', async () => {
    getEnvVars.mockResolvedValue({
      OPENROUTER_API_KEY: keyVar({
        is_set: true,
        provider: 'openrouter',
        provider_label: 'OpenRouter'
      }),
      FIREWORKS_API_KEY: keyVar({
        is_set: true,
        provider: 'fireworks',
        provider_label: 'Fireworks AI'
      })
    })

    const { ProvidersSettings } = await import('./providers-settings')
    render(<ProvidersSettings onClose={vi.fn()} onViewChange={vi.fn()} view="keys" />)

    expect(await screen.findByText('Houdry server URL')).toBeTruthy()
    expect(screen.queryByText('OpenRouter')).toBeNull()
    expect(screen.queryByText('Fireworks AI')).toBeNull()
  })

  it('offers a Houdry fabric URL entry in the API-keys tab that opens the custom-endpoint flow', async () => {
    getEnvVars.mockResolvedValue({})

    const { ProvidersSettings } = await import('./providers-settings')
    render(<ProvidersSettings onClose={vi.fn()} onViewChange={vi.fn()} view="keys" />)

    const row = await screen.findByText('Houdry server URL')
    expect(screen.getByText(/fabric control plane/)).toBeTruthy()

    fireEvent.click(row)

    await waitFor(() => expect(startManualLocalEndpoint).toHaveBeenCalledWith(null))
  })
})
