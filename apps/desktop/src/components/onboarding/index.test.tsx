import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { I18nProvider } from '@/i18n'
import { $desktopOnboarding, type DesktopOnboardingState, type OnboardingContext } from '@/store/onboarding'
import { makeOAuthProvider } from '@/test/oauth-provider'
import type { OAuthProvider } from '@/types/hermes'

import { Picker } from '.'

function renderPicker(ctx: OnboardingContext) {
  return render(
    <I18nProvider configClient={null} initialLocale="en">
      <Picker ctx={ctx} />
    </I18nProvider>
  )
}

function setProviders(providers: OAuthProvider[]) {
  $desktopOnboarding.set({
    configured: false,
    flow: { status: 'idle' },
    mode: 'oauth',
    providers,
    reason: null,
    requested: false,
    firstRunSkipped: false,
    manual: false,
    localEndpoint: false
  } satisfies DesktopOnboardingState)
}

const ctx: OnboardingContext = { requestGateway: async () => undefined as never }

afterEach(() => {
  cleanup()

  try {
    window.localStorage.clear()
  } catch {
    // jsdom localStorage should always be present; ignore if not.
  }

  $desktopOnboarding.set({
    configured: null,
    flow: { status: 'idle' },
    mode: 'oauth',
    providers: null,
    reason: null,
    requested: false,
    firstRunSkipped: false,
    manual: false,
    localEndpoint: false
  })
})

describe('onboarding Picker', () => {
  it('shows only Azure OpenAI and Houdry fabric', () => {
    setProviders([makeOAuthProvider('anthropic', 'Anthropic Claude'), makeOAuthProvider('nous', 'Nous Portal')])
    renderPicker(ctx)

    expect(screen.getByText('Azure OpenAI (GPT-5.6 Luna)')).toBeTruthy()
    expect(screen.getByText('Houdry server URL')).toBeTruthy()
    expect(screen.getAllByText('Recommended').length).toBe(2)
    expect(screen.queryByText('Nous Portal')).toBeNull()
    expect(screen.queryByText('Fireworks AI')).toBeNull()
    expect(screen.queryByText('Anthropic API Key')).toBeNull()
    expect(screen.queryByText('Other providers')).toBeNull()
  })

  it('does not surface OAuth vendors when Nous Portal is absent', () => {
    setProviders([
      makeOAuthProvider('anthropic', 'Anthropic Claude'),
      makeOAuthProvider('openai-codex', 'OpenAI Codex / ChatGPT')
    ])
    renderPicker(ctx)

    expect(screen.getByText('Azure OpenAI (GPT-5.6 Luna)')).toBeTruthy()
    expect(screen.getByText('Houdry server URL')).toBeTruthy()
    expect(screen.queryByText('Fireworks AI')).toBeNull()
    expect(screen.queryByText('Anthropic API Key')).toBeNull()
    expect(screen.queryByText('ChatGPT or Codex Subscription')).toBeNull()
    expect(screen.queryByText('Other sign-in options')).toBeNull()
  })

  it('offers "choose later" on first run and persists the skip', () => {
    setProviders([makeOAuthProvider('nous', 'Nous Portal')])
    renderPicker(ctx)

    const skip = screen.getByRole('button', { name: "I'll choose a provider later" })

    fireEvent.click(skip)

    expect($desktopOnboarding.get().firstRunSkipped).toBe(true)
    expect(window.localStorage.getItem('hermes-onboarding-skipped-v1')).toBe('1')
  })

  it('hides "choose later" in manual (add-provider) mode', () => {
    setProviders([makeOAuthProvider('nous', 'Nous Portal')])
    $desktopOnboarding.set({ ...$desktopOnboarding.get(), manual: true })
    renderPicker(ctx)

    expect(screen.queryByRole('button', { name: "I'll choose a provider later" })).toBeNull()
  })
})
