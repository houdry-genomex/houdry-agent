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
  it('prefers a loopback control plane over a WiFi advertisement', async () => {
    stubFabric({
      discover: async () => [
        {
          api: 'http://192.168.1.10:8080/v1',
          auth: false,
          name: 'lab',
          openai: true,
          url: 'http://192.168.1.10:8080'
        }
      ],
      isControlPlane: async origin => origin === 'http://127.0.0.1:18080'
    })

    const hit = await scanPreferredControlPlane()

    expect(hit?.api).toBe('http://127.0.0.1:18080/v1')
    expect(hit?.source).toBe('this-computer')
  })

  it('returns the WiFi plane when this computer is not serving', async () => {
    stubFabric({
      discover: async () => [
        {
          api: 'http://192.168.1.10:8080/v1',
          auth: false,
          name: 'lab',
          openai: true,
          url: 'http://192.168.1.10:8080'
        }
      ],
      isControlPlane: async () => false
    })

    const hit = await scanPreferredControlPlane()

    expect(hit?.api).toBe('http://192.168.1.10:8080/v1')
    expect(hit?.source).toBe('wifi')
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

        return origin === 'http://10.1.1.5:18080'
      }
    })

    await expect(probeControlPlane('http://10.1.1.5:18080/v1')).resolves.toBe(true)
    expect(seen).toEqual(['http://10.1.1.5:18080'])
  })

  it('returns false when the saved URL is not a control plane', async () => {
    stubFabric({ isControlPlane: async () => false })

    await expect(probeControlPlane('http://10.179.222.111:8090/v1')).resolves.toBe(false)
  })
})
