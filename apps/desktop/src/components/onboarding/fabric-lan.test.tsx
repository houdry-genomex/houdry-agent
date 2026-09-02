import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DesktopHoudryFabricEndpoint } from '@/global'
import { I18nProvider } from '@/i18n'

import { type FabricLanAdoptMode, FabricLanPanel } from './fabric-lan'

function ep(
  over: Partial<DesktopHoudryFabricEndpoint> & Pick<DesktopHoudryFabricEndpoint, 'api' | 'url'>
): DesktopHoudryFabricEndpoint {
  return { auth: false, name: '', openai: true, ...over }
}

function renderPanel({
  discover,
  onAdopt = vi.fn<(api: string, mode: FabricLanAdoptMode) => void>(),
  scanThisComputer = async () => null,
  selectedApi = ''
}: {
  discover: () => Promise<DesktopHoudryFabricEndpoint[]>
  onAdopt?: ReturnType<typeof vi.fn<(api: string, mode: FabricLanAdoptMode) => void>>
  scanThisComputer?: () => Promise<string | null>
  selectedApi?: string
}) {
  return {
    onAdopt,
    ...render(
      <I18nProvider configClient={null} initialLocale="en">
        <FabricLanPanel
          discover={discover}
          onAdopt={onAdopt}
          scanThisComputer={scanThisComputer}
          selectedApi={selectedApi}
        />
      </I18nProvider>
    )
  }
}

afterEach(() => {
  cleanup()
})

describe('FabricLanPanel', () => {
  it('shows an empty state when nothing answers on WiFi', async () => {
    renderPanel({ discover: async () => [] })

    expect(screen.getByText('Looking for a control plane on this WiFi…')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText(/No control plane on this WiFi/)).toBeTruthy()
    })

    expect(screen.getByRole('button', { name: /Scan again/ })).toBeTruthy()
  })

  it('adopts a single control plane and shows its host', async () => {
    const { onAdopt } = renderPanel({
      discover: async () => [
        ep({ api: 'http://192.168.1.10:8080/v1', name: 'houdry-lab', url: 'http://192.168.1.10:8080' })
      ],
      selectedApi: 'http://192.168.1.10:8080/v1'
    })

    await waitFor(() => {
      expect(screen.getByText('houdry-lab')).toBeTruthy()
    })

    expect(screen.getByText('192.168.1.10:8080')).toBeTruthy()
    expect(screen.getByText('Found a control plane on this WiFi')).toBeTruthy()
    expect(onAdopt).toHaveBeenCalledWith('http://192.168.1.10:8080/v1', 'auto')
  })

  it('lists several planes and does not auto-pick', async () => {
    const { onAdopt } = renderPanel({
      discover: async () => [
        ep({ api: 'http://192.168.1.10:8080/v1', name: 'desk', url: 'http://192.168.1.10:8080' }),
        ep({ api: 'http://192.168.1.40:8080/v1', name: 'workshop', url: 'http://192.168.1.40:8080' })
      ]
    })

    await waitFor(() => {
      expect(screen.getByText('Several control planes on this WiFi. Pick one.')).toBeTruthy()
    })

    expect(screen.getByText('desk')).toBeTruthy()
    expect(screen.getByText('workshop')).toBeTruthy()
    expect(onAdopt).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /workshop/ }))

    expect(onAdopt).toHaveBeenCalledWith('http://192.168.1.40:8080/v1', 'pick')
  })

  it('falls back to this computer when WiFi is empty but loopback answers', async () => {
    const { onAdopt } = renderPanel({
      discover: async () => [],
      scanThisComputer: async () => 'http://127.0.0.1:8080/v1',
      selectedApi: 'http://127.0.0.1:8080/v1'
    })

    await waitFor(() => {
      expect(screen.getByText('This computer')).toBeTruthy()
    })

    await waitFor(() => {
      expect(screen.getByText('houdry serve on this machine')).toBeTruthy()
    })

    expect(onAdopt).toHaveBeenCalledWith('http://127.0.0.1:8080/v1', 'auto')
  })

  it('prefers this computer over a WiFi advertisement of the same serve', async () => {
    const { onAdopt } = renderPanel({
      discover: async () => [
        ep({
          api: 'http://172.24.110.66:8090/v1',
          name: 'houdry-Lethal_laptop-8090',
          url: 'http://172.24.110.66:8090'
        })
      ],
      scanThisComputer: async () => 'http://127.0.0.1:8090/v1',
      selectedApi: 'http://127.0.0.1:8090/v1'
    })

    await waitFor(() => {
      expect(screen.getByText('This computer')).toBeTruthy()
    })

    expect(onAdopt).toHaveBeenCalledWith('http://127.0.0.1:8090/v1', 'auto')
    expect(screen.queryByText('houdry-Lethal_laptop-8090')).toBeNull()
  })
})
