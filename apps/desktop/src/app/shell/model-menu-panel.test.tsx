import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { useModelControls } from '@/app/session/hooks/use-model-controls'
import { DropdownMenu, DropdownMenuContent } from '@/components/ui/dropdown-menu'
import { $collapsedProviders, toggleCollapsedProvider } from '@/store/provider-collapse'
import { $activeSessionId, $currentModel, $currentProvider } from '@/store/session'

import { ModelMenuPanel } from './model-menu-panel'

const notify = vi.fn((..._args: unknown[]) => 'confirm-toast-1')
const notifyError = vi.fn((..._args: unknown[]) => undefined)
const dismissNotification = vi.fn((..._args: unknown[]) => undefined)

vi.mock('@/store/notifications', () => ({
  dismissNotification: (...args: unknown[]) => dismissNotification(...args),
  notify: (...args: unknown[]) => notify(...args),
  notifyError: (...args: unknown[]) => notifyError(...args)
}))

// Radix calls these on open; jsdom doesn't implement them.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
})

const getGlobalModelOptions = vi.fn()

vi.mock('@/hermes', () => ({
  getGlobalModelOptions: (...args: unknown[]) => getGlobalModelOptions(...args),
  setApiRequestProfile: vi.fn()
}))

const AZURE_PROVIDER = {
  models: ['gpt-5.6-luna', 'gpt-4o', 'gpt-4o-mini'],
  name: 'Azure OpenAI',
  slug: 'azure'
}

const HOUDRY_PROVIDER = {
  models: ['auto', 'llama-70b', 'qwen-32b'],
  name: 'Houdry GPU fabric',
  slug: 'custom'
}

const MOCK_PROVIDERS = [AZURE_PROVIDER, HOUDRY_PROVIDER]

beforeEach(() => {
  $activeSessionId.set('runtime-1')
  $currentModel.set('')
  $currentProvider.set('')
  $collapsedProviders.set([])
  getGlobalModelOptions.mockResolvedValue({ providers: MOCK_PROVIDERS })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderPanel(onSelectModel = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  const content = render(
    <QueryClientProvider client={client}>
      <DropdownMenu open>
        <DropdownMenuContent>
          <ModelMenuPanel onSelectModel={onSelectModel} requestGateway={vi.fn() as never} />
        </DropdownMenuContent>
      </DropdownMenu>
    </QueryClientProvider>
  )

  return { onSelectModel, content }
}

describe('ModelMenuPanel inference allowlist', () => {
  it('does not list OpenCode Free, MoA, or other third-party catalogs', async () => {
    getGlobalModelOptions.mockResolvedValue({
      providers: [
        { models: ['x-preview-f-free'], name: 'OpenCode Free', slug: 'opencode-free' },
        { models: ['BeastMode'], name: 'Mixture of Agents', slug: 'moa' },
        AZURE_PROVIDER,
        HOUDRY_PROVIDER
      ]
    })

    const { content } = renderPanel()

    expect(await content.findByText('Azure OpenAI')).toBeTruthy()
    expect(content.getByText('Houdry GPU fabric')).toBeTruthy()
    expect(content.queryByText('OpenCode Free')).toBeNull()
    expect(content.queryByText('MoA: BeastMode')).toBeNull()
    expect(content.queryByText('Mixture of Agents')).toBeNull()
  })
})

describe('ModelMenuPanel current selection', () => {
  it('keeps the checkmark on the live SessionView model when a stale options response disagrees', async () => {
    $currentProvider.set('custom')
    $currentModel.set('auto')
    getGlobalModelOptions.mockResolvedValue({
      model: 'gpt-4o',
      provider: 'azure',
      providers: MOCK_PROVIDERS
    })

    const { content } = renderPanel()

    const currentRow = (await content.findByText(/^Auto$/i)).closest('[role="menuitem"]')
    const staleRow = content.getByText('GPT-4o').closest('[role="menuitem"]')

    expect(currentRow?.querySelector('.codicon-check')).not.toBeNull()
    expect(staleRow?.querySelector('.codicon-check')).toBeNull()
  })
})

describe('ModelMenuPanel search', () => {
  // The pinned current model must NOT ride along on a query it doesn't match:
  // it reads like the top result, so Enter/click picks the wrong model (the
  // "type grok, get fable" bug). Every surveyed picker (VS Code, Zed, Open
  // WebUI, Cherry Studio) drops the pin while filtering.
  // Highlighted labels are split across <mark> nodes, so single-text-node
  // queries miss them — match on the row span's composed textContent.
  const rowWithText = (content: ReturnType<typeof renderPanel>['content'], pattern: RegExp) =>
    content.queryByText((_, element) => element?.tagName === 'SPAN' && pattern.test(element.textContent ?? ''))

  it('hides the non-matching current model while a query is active', async () => {
    $currentProvider.set('azure')
    $currentModel.set('gpt-5.6-luna')
    const { content } = renderPanel()

    await content.findByText(/GPT-5\.6-luna/i)

    const input = screen.getByRole('textbox', { name: 'Search models' })
    fireEvent.change(input, { target: { value: 'llama' } })

    await vi.waitFor(() => {
      expect(rowWithText(content, /Llama 70b/i)).not.toBeNull()
    })
    expect(rowWithText(content, /GPT-5\.6-luna/i)).toBeNull()
  })

  it('Enter in the search field commits the first match', async () => {
    const { content, onSelectModel } = renderPanel()

    await content.findByText('Azure OpenAI')

    const input = screen.getByRole('textbox', { name: 'Search models' })
    fireEvent.change(input, { target: { value: 'llama' } })

    await vi.waitFor(() => {
      expect(rowWithText(content, /Llama 70b/i)).not.toBeNull()
    })

    fireEvent.keyDown(input, { key: 'Enter' })

    await vi.waitFor(() => {
      expect(onSelectModel).toHaveBeenCalledWith({
        model: 'llama-70b',
        provider: 'custom',
        sessionId: 'runtime-1'
      })
    })
  })

  it('Enter with no matches is a no-op (menu stays put, nothing selected)', async () => {
    const { content, onSelectModel } = renderPanel()

    await content.findByText('Azure OpenAI')

    const input = screen.getByRole('textbox', { name: 'Search models' })
    fireEvent.change(input, { target: { value: 'zzz-no-such-model' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelectModel).not.toHaveBeenCalled()
  })

  it('arrows move the selection without leaving the input; Enter commits the stepped row', async () => {
    const { content, onSelectModel } = renderPanel()

    await content.findByText('Azure OpenAI')

    const input = screen.getByRole('textbox', { name: 'Search models' })
    fireEvent.change(input, { target: { value: 'gpt' } })

    await vi.waitFor(() => {
      expect(rowWithText(content, /GPT-4o-mini/i)).not.toBeNull()
    })

    // First match auto-selected; ↓ steps to the second match.
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    await vi.waitFor(() => {
      expect(onSelectModel).toHaveBeenCalledWith({
        model: 'gpt-4o',
        provider: 'azure',
        sessionId: 'runtime-1'
      })
    })
  })

  it('with no query the selection sits on the current model, so Enter closes without switching', async () => {
    $currentProvider.set('custom')
    $currentModel.set('auto')
    const { content, onSelectModel } = renderPanel()

    await content.findByText('Azure OpenAI')

    const input = screen.getByRole('textbox', { name: 'Search models' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelectModel).not.toHaveBeenCalled()
  })

  it('filters fabric models by the query instead of leaving extras as phantom first matches', async () => {
    const { content, onSelectModel } = renderPanel()

    await content.findByText('Houdry GPU fabric')

    const input = screen.getByRole('textbox', { name: 'Search models' })
    fireEvent.change(input, { target: { value: 'llama' } })

    await vi.waitFor(() => {
      expect(rowWithText(content, /Llama 70b/i)).not.toBeNull()
    })
    expect(rowWithText(content, /^Auto$/i)).toBeNull()

    fireEvent.keyDown(input, { key: 'Enter' })

    await vi.waitFor(() => {
      expect(onSelectModel).toHaveBeenCalledWith({ model: 'llama-70b', provider: 'custom', sessionId: 'runtime-1' })
    })
  })
})

describe('ModelMenuPanel provider collapse', () => {
  it('shows all provider models by default (none collapsed)', async () => {
    const { content } = renderPanel()

    await content.findByText('Azure OpenAI')
    expect(content.queryByText('GPT-5.6-luna')).not.toBeNull()
    expect(content.queryByText('GPT-4o')).not.toBeNull()
  })

  it('collapses provider models when header is clicked', async () => {
    const { content } = renderPanel()

    const header = await content.findByText('Azure OpenAI')
    fireEvent.click(header)

    // Models should disappear but header stays
    expect(content.queryByText('GPT-5.6-luna')).toBeNull()
    expect(content.queryByText('Azure OpenAI')).not.toBeNull()
  })

  it('expands provider models when header is clicked again', async () => {
    const { content } = renderPanel()

    const header = await content.findByText('Azure OpenAI')
    // Collapse
    fireEvent.click(header)
    expect(content.queryByText('GPT-5.6-luna')).toBeNull()
    // Expand
    fireEvent.click(header)
    await vi.waitFor(() => {
      expect(content.queryByText('GPT-5.6-luna')).not.toBeNull()
    })
  })

  it('collapses the active provider too (no forced auto-expand)', async () => {
    $currentProvider.set('azure')
    $currentModel.set('gpt-5.6-luna')
    const { content } = renderPanel()

    const header = await content.findByText('Azure OpenAI')
    fireEvent.click(header)

    // The current provider is collapsible like any other — clicking its header
    // hides its models rather than forcing them to stay open.
    await vi.waitFor(() => {
      expect(content.queryByText('GPT-5.6-luna')).toBeNull()
    })
  })

  it('bypasses collapse when search is active', async () => {
    const { content } = renderPanel()

    const header = await content.findByText('Azure OpenAI')
    fireEvent.click(header)
    expect(content.queryByText('GPT-5.6-luna')).toBeNull()

    // Type in the search bar (auto-focused by DropdownMenuSearch)
    const input = screen.getByRole('textbox', { name: 'Search models' })
    expect(input).not.toBeNull()
    fireEvent.change(input, { target: { value: 'luna' } })

    // Should show models — search bypasses collapse. The matched letters render
    // inside a <mark>, splitting the label across nodes, so match on the row
    // span's composed textContent instead of a single text node.
    await vi.waitFor(() => {
      expect(
        content.queryByText(
          (_, element) => element?.tagName === 'SPAN' && (element.textContent ?? '').startsWith('GPT-5.6-luna')
        )
      ).not.toBeNull()
    })
  })

  it('toggles collapse via keyboard Enter on header', async () => {
    const { content } = renderPanel()

    const header = await content.findByText('Azure OpenAI')
    // Radix DropdownMenuItem fires onSelect on Enter from the onKeyDown handler
    fireEvent.keyDown(header.closest('[role="menuitem"]') ?? header, { key: 'Enter' })

    expect(content.queryByText('GPT-5.6-luna')).toBeNull()
  })

  // The collapsed-providers set is a global presentation preference
  // (`hermes.desktop.collapsed-providers`), but the catalog the picker renders
  // is profile-scoped (`getGlobalModelOptions` routes through
  // `profileScoped()`). Pruning the global set against only the active catalog
  // would silently delete a user's collapse preference on every profile switch
  // whose configured providers don't include the slug — the bug the maintainer
  // flagged. The set must survive catalog changes; if the same provider shows
  // up again later, the previous collapse is preserved.
  it('preserves the collapsed set across a profile switch whose catalog lacks the slug', async () => {
    toggleCollapsedProvider('azure')
    toggleCollapsedProvider('custom')
    expect($collapsedProviders.get()).toEqual(['azure', 'custom'])

    // Profile A: both providers present, render + unmount.
    getGlobalModelOptions.mockResolvedValueOnce({ providers: MOCK_PROVIDERS })
    const a = renderPanel()
    await a.content.findByText('Azure OpenAI')
    a.content.unmount()

    // Profile B: fabric is not in the catalog (simulates a profile whose
    // configured providers differ). The previously-collapsed 'custom' slug
    // must survive — pruning it would lose state across a profile switch.
    getGlobalModelOptions.mockResolvedValueOnce({ providers: [AZURE_PROVIDER] })
    const b = renderPanel()
    await b.content.findByText('Azure OpenAI')

    expect($collapsedProviders.get()).toEqual(['azure', 'custom'])
  })

  it('preserves the collapsed set when Refresh Models drops a provider', async () => {
    toggleCollapsedProvider('azure')
    toggleCollapsedProvider('custom')

    // First load: both providers present.
    getGlobalModelOptions.mockResolvedValueOnce({ providers: MOCK_PROVIDERS })
    const a = renderPanel()
    await a.content.findByText('Azure OpenAI')
    a.content.unmount()

    // Refresh Models returns a catalog that drops fabric (revoked endpoint,
    // plugin disabled, backend policy change). 'custom' must survive — the
    // user explicitly collapsed it, and the global set is not tied to any
    // single refresh.
    getGlobalModelOptions.mockResolvedValueOnce({ providers: [AZURE_PROVIDER] })
    const b = renderPanel()
    await b.content.findByText('Azure OpenAI')

    expect($collapsedProviders.get()).toContain('custom')
    expect($collapsedProviders.get()).toContain('azure')
  })

  it('switches the session model when Refresh Models drops the current pick', async () => {
    $currentProvider.set('azure')
    $currentModel.set('gpt-5.6-luna')
    getGlobalModelOptions
      .mockResolvedValueOnce({
        model: 'gpt-5.6-luna',
        provider: 'azure',
        providers: MOCK_PROVIDERS
      })
      .mockResolvedValueOnce({
        model: 'gpt-5.6-luna',
        provider: 'azure',
        providers: [HOUDRY_PROVIDER]
      })

    const { content, onSelectModel } = renderPanel()

    await content.findByText(/GPT-5\.6-luna/i)

    fireEvent.click(await content.findByText('Refresh Models'))

    await vi.waitFor(() => {
      expect(onSelectModel).toHaveBeenCalledWith({
        model: 'auto',
        provider: 'custom',
        sessionId: 'runtime-1'
      })
    })
  })

  it('does not switch when Refresh Models still lists the current pick', async () => {
    $currentProvider.set('azure')
    $currentModel.set('gpt-5.6-luna')
    getGlobalModelOptions.mockResolvedValue({ providers: MOCK_PROVIDERS })

    const { content, onSelectModel } = renderPanel()

    await content.findByText(/GPT-5.6-luna/i)
    fireEvent.click(await content.findByText('Refresh Models'))

    await vi.waitFor(() => {
      expect(getGlobalModelOptions).toHaveBeenCalledTimes(2)
    })
    expect(onSelectModel).not.toHaveBeenCalled()
  })
})

describe('ModelMenuPanel refresh reconcile × guarded-switch confirm handshake', () => {
  // #95446 fix (reconcile after Refresh Models) composes with the
  // confirm-handshake guard: when the reconcile target is itself a GUARDED
  // model (contributor tier / expensive), the switch must surface the confirm
  // flow — one config.set, a warning with a Confirm action, rollback until
  // confirmed — never a silent retry loop and never a silently-painted pick.
  function ConfirmHarness({
    requestGateway
  }: {
    requestGateway: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>
  }) {
    const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
    const controls = useModelControls({ queryClient: client, requestGateway })

    return (
      <QueryClientProvider client={client}>
        <DropdownMenu open>
          <DropdownMenuContent>
            <ModelMenuPanel onSelectModel={controls.selectModel} requestGateway={requestGateway as never} />
          </DropdownMenuContent>
        </DropdownMenu>
      </QueryClientProvider>
    )
  }

  it('reconcile-triggered switch to a guarded model surfaces confirm, not a silent retry', async () => {
    $activeSessionId.set('runtime-1')
    $currentProvider.set('azure')
    $currentModel.set('gpt-5.6-luna')
    getGlobalModelOptions
      .mockResolvedValueOnce({
        providers: [{ models: ['gpt-5.6-luna'], name: 'Azure OpenAI', slug: 'azure' }]
      })
      // Refresh drops the current pick; the only remaining model is guarded.
      .mockResolvedValueOnce({
        providers: [{ models: ['llama-70b'], name: 'Houdry GPU fabric', slug: 'custom' }]
      })

    // Method-aware gateway: the panel's catalog reads (`model.options`) fall
    // back to the REST mock; `config.set` runs the guarded handshake —
    // confirm_required first, success on the confirmed resend.
    let configSets = 0

    const requestGateway = vi.fn(async (method: string, _params?: Record<string, unknown>) => {
      if (method !== 'config.set') {
        throw new Error('use REST catalog')
      }

      configSets += 1

      if (configSets === 1) {
        return {
          confirm_message: 'CONTRIBUTOR TIER: this model may train on your data.',
          confirm_required: true,
          key: 'model',
          value: 'llama-70b'
        }
      }

      return { key: 'model', scope: 'global', value: 'llama-70b' }
    })

    const content = render(<ConfirmHarness requestGateway={requestGateway as never} />)

    await content.findByText(/GPT-5\.6-luna/i)
    fireEvent.click(await content.findByText('Refresh Models'))

    // The reconcile fired exactly ONE switch attempt and it came back
    // confirm_required → the confirm toast is up, nothing retried silently.
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.objectContaining({ label: expect.any(String) }),
          kind: 'warning',
          message: 'CONTRIBUTOR TIER: this model may train on your data.'
        })
      )
    })

    const configSetCalls = requestGateway.mock.calls.filter(([method]) => method === 'config.set')
    expect(configSetCalls).toHaveLength(1)
    expect(configSetCalls[0][1]).not.toHaveProperty('confirm_expensive_model')

    // Pending confirmation = rolled back, not silently painted.
    expect($currentModel.get()).toBe('gpt-5.6-luna')
    expect($currentProvider.get()).toBe('azure')

    // User confirms → ONE resend carrying confirm_expensive_model: true.
    const lastNotify = notify.mock.calls.at(-1)?.[0] as { action: { onClick: () => Promise<void> } }

    await act(async () => {
      await lastNotify.action.onClick()
    })

    await vi.waitFor(() => {
      const resend = requestGateway.mock.calls.filter(([method]) => method === 'config.set')
      expect(resend).toHaveLength(2)
      expect(resend[1][1]).toMatchObject({ confirm_expensive_model: true, session_id: 'runtime-1' })
    })
    expect($currentModel.get()).toBe('llama-70b')
    expect($currentProvider.get()).toBe('custom')
    expect(notifyError).not.toHaveBeenCalled()
  })
})
