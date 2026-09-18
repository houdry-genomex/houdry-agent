import { afterEach, describe, expect, it } from 'vitest'

import { probeControlPlane, scanPreferredControlPlane } from './control-plane-scan'

function stubFabric(opts: {
  discover?: () => Promise<
    Array<{ api: string; auth: boolean; name: string; openai: boolean; url: string }>
  >
  isControlPlane?: (origin: string) => Promise<boolean>
}) {
  Object.defineProperty(window, 'hermesDesktop', {
    configurable: true,
    value: {
      houdryFabric: {
        discover: opts.discover ?? (async () => []),
        isControlPlane: opts.isControlPlane ?? (async () => false)
      }
    }
  })
}

afterEach(() => {
  Reflect.deleteProperty(window, 'hermesDesktop')
})

describe('scanPreferredControlPlane', () => {
  it('never adopts a loopback control plane, even when isControlPlane would answer for one', async () => {
    stubFabric({
      discover: async () => [
        {
          api: 'https://192.168.1.10:8080/v1',
          auth: false,
          name: 'lab',
          openai: true,
          url: 'https://192.168.1.10:8080'
        }
      ],
      // Even if a control plane happens to be reachable on THIS machine's
      // loopback, the WiFi-only scan must never surface or prefer it — that
      // is exactly the "shows localhost instead of the WiFi IP" bug.
      isControlPlane: async origin => origin === 'https://127.0.0.1:18080'
    })

    const hit = await scanPreferredControlPlane()

    expect(hit?.api).toBe('https://192.168.1.10:8080/v1')
    expect(hit?.source).toBe('wifi')
  })

  it('returns the WiFi plane when this computer is not serving', async () => {
    stubFabric({
      discover: async () => [
        {
          api: 'https://192.168.1.10:8080/v1',
          auth: false,
          name: 'lab',
          openai: true,
          url: 'https://192.168.1.10:8080'
        }
      ],
      isControlPlane: async () => false
    })

    const hit = await scanPreferredControlPlane()

    expect(hit?.api).toBe('https://192.168.1.10:8080/v1')
    expect(hit?.source).toBe('wifi')
  })

  it('ignores a loopback advertise so the WiFi scan never adopts 127.0.0.1', async () => {
    stubFabric({
      discover: async () => [
        {
          api: 'https://127.0.0.1:18080/v1',
          auth: false,
          name: 'leftover-local',
          openai: true,
          url: 'https://127.0.0.1:18080'
        },
        {
          api: 'https://192.168.29.48:18080/v1',
          auth: false,
          name: 'houdry-hp',
          openai: true,
          url: 'https://192.168.29.48:18080'
        }
      ]
    })

    const hit = await scanPreferredControlPlane()

    expect(hit?.api).toBe('https://192.168.29.48:18080/v1')
    expect(hit?.source).toBe('wifi')
  })

  it('returns null when the only advertise is loopback', async () => {
    stubFabric({
      discover: async () => [
        {
          api: 'https://127.0.0.1:18080/v1',
          auth: false,
          name: 'leftover-local',
          openai: true,
          url: 'https://127.0.0.1:18080'
        }
      ]
    })

    expect(await scanPreferredControlPlane()).toBeNull()
  })

  it('returns null when nothing answers', async () => {
    stubFabric({})

    expect(await scanPreferredControlPlane()).toBeNull()
  })
})

describe('probeControlPlane', () => {
  it('asks isControlPlane with the origin, not the /v1 path', async () => {
    const seen: string[] = []

    stubFabric({
      isControlPlane: async origin => {
        seen.push(origin)

        return origin === 'https://10.1.1.5:18080'
      }
    })

    await expect(probeControlPlane('https://10.1.1.5:18080/v1')).resolves.toBe(true)
    expect(seen).toEqual(['https://10.1.1.5:18080'])
  })

  it('returns false when the saved URL is not a control plane', async () => {
    stubFabric({ isControlPlane: async () => false })

    await expect(probeControlPlane('https://10.179.222.111:8090/v1')).resolves.toBe(false)
  })
})
