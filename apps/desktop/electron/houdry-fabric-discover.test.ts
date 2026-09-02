import { describe, expect, it } from 'vitest'

import {
  ipv4Broadcast,
  isControlPlaneWellKnown,
  parseHoudryAdvertise,
  udpBroadcastTargets,
  uniqueFabricEndpoints
} from './houdry-fabric-discover'

describe('parseHoudryAdvertise', () => {
  it('accepts a v1 control-plane reply', () => {
    const ep = parseHoudryAdvertise(
      JSON.stringify({
        houdry: 'control-plane',
        v: 1,
        url: 'http://192.168.1.10:8080',
        path: '/v1',
        name: 'houdry-lab',
        version: '0.6.0',
        auth: true,
        openai: true
      })
    )

    expect(ep).toEqual({
      name: 'houdry-lab',
      url: 'http://192.168.1.10:8080',
      api: 'http://192.168.1.10:8080/v1',
      version: '0.6.0',
      auth: true,
      openai: true
    })
  })

  it('defaults the API path to /v1 and strips a trailing slash', () => {
    const ep = parseHoudryAdvertise(
      JSON.stringify({ houdry: 'control-plane', v: 1, url: 'http://10.0.0.5:8080/' })
    )

    expect(ep?.api).toBe('http://10.0.0.5:8080/v1')
    expect(ep?.url).toBe('http://10.0.0.5:8080')
  })

  it('ignores probes and junk', () => {
    expect(parseHoudryAdvertise(JSON.stringify({ houdry: 'discover', v: 1 }))).toBeNull()
    expect(parseHoudryAdvertise('not json')).toBeNull()
    expect(parseHoudryAdvertise(JSON.stringify({ houdry: 'control-plane', v: 2, url: 'http://x' }))).toBeNull()
  })
})

describe('isControlPlaneWellKnown', () => {
  it('accepts the v1 identity document', () => {
    expect(isControlPlaneWellKnown({ houdry: 'control-plane', v: 1, path: '/v1' })).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isControlPlaneWellKnown({ houdry: 'control-plane', v: 2 })).toBe(false)
    expect(isControlPlaneWellKnown({ ok: true })).toBe(false)
    expect(isControlPlaneWellKnown(null)).toBe(false)
  })
})

describe('uniqueFabricEndpoints', () => {
  it('dedupes by URL and keeps a name when a later reply has one', () => {
    const out = uniqueFabricEndpoints([
      {
        name: '',
        url: 'http://a:8080',
        api: 'http://a:8080/v1',
        auth: false,
        openai: true
      },
      {
        name: 'desk',
        url: 'http://a:8080',
        api: 'http://a:8080/v1',
        auth: false,
        openai: true
      },
      {
        name: 'other',
        url: 'http://b:8080',
        api: 'http://b:8080/v1',
        auth: false,
        openai: true
      }
    ])

    expect(out).toHaveLength(2)
    expect(out[0].name).toBe('desk')
    expect(out[1].name).toBe('other')
  })

  it('collapses one instance advertised on WiFi and WSL to the WiFi URL', () => {
    const out = uniqueFabricEndpoints(
      [
      {
        name: 'houdry-Lethal_laptop-8090',
        url: 'http://172.23.96.1:8090',
        api: 'http://172.23.96.1:8090/v1',
        auth: false,
        openai: true
      },
      {
        name: 'houdry-Lethal_laptop-8090',
        url: 'http://192.168.29.179:8090',
        api: 'http://192.168.29.179:8090/v1',
        auth: false,
        openai: true
      }
      ],
      {}
    )

    expect(out).toHaveLength(1)
    expect(out[0].url).toBe('http://192.168.29.179:8090')
  })

  it('rewrites this machine\'s WiFi/WSL ads to 127.0.0.1', () => {
    const ifaces = {
      'vEthernet (WSL)': [
        {
          address: '172.23.96.1',
          netmask: '255.255.240.0',
          family: 'IPv4' as const,
          mac: '',
          internal: false,
          cidr: null
        }
      ],
      'Wi-Fi': [
        {
          address: '172.24.110.66',
          netmask: '255.255.255.0',
          family: 'IPv4' as const,
          mac: '',
          internal: false,
          cidr: null
        }
      ]
    }

    const out = uniqueFabricEndpoints(
      [
        {
          name: 'houdry-Lethal_laptop-8090',
          url: 'http://172.23.96.1:8090',
          api: 'http://172.23.96.1:8090/v1',
          auth: false,
          openai: true
        },
        {
          name: 'houdry-Lethal_laptop-8090',
          url: 'http://172.24.110.66:8090',
          api: 'http://172.24.110.66:8090/v1',
          auth: false,
          openai: true
        }
      ],
      ifaces
    )

    expect(out).toHaveLength(1)
    expect(out[0].url).toBe('http://127.0.0.1:8090')
    expect(out[0].api).toBe('http://127.0.0.1:8090/v1')
  })
})

describe('ipv4Broadcast', () => {
  it('computes a directed broadcast', () => {
    expect(ipv4Broadcast('192.168.1.40', '255.255.255.0')).toBe('192.168.1.255')
    expect(ipv4Broadcast('10.0.0.5', '255.255.0.0')).toBe('10.0.255.255')
  })

  it('rejects garbage', () => {
    expect(ipv4Broadcast('::1', '255.255.255.0')).toBeNull()
    expect(ipv4Broadcast('192.168.1.1', 'ffff')).toBeNull()
  })
})

describe('udpBroadcastTargets', () => {
  it('always includes limited broadcast and the houdry multicast group', () => {
    const targets = udpBroadcastTargets({})

    expect(targets).toEqual(['255.255.255.255', '239.255.77.77'])
  })

  it('adds per-interface directed broadcasts and skips loopback', () => {
    const targets = udpBroadcastTargets({
      Loopback: [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '', internal: true, cidr: null }],
      'Wi-Fi': [
        { address: '192.168.1.40', netmask: '255.255.255.0', family: 'IPv4', mac: '', internal: false, cidr: null }
      ]
    })

    expect(targets).toContain('192.168.1.255')
    expect(targets).not.toContain('127.255.255.255')
  })

  it('does not probe Hyper-V/WSL virtual adapters', () => {
    const targets = udpBroadcastTargets({
      'vEthernet (WSL)': [
        { address: '172.23.96.1', netmask: '255.255.240.0', family: 'IPv4', mac: '', internal: false, cidr: null }
      ],
      'Wi-Fi': [
        { address: '192.168.29.179', netmask: '255.255.255.0', family: 'IPv4', mac: '', internal: false, cidr: null }
      ]
    })

    expect(targets).toContain('192.168.29.255')
    expect(targets).not.toContain('172.23.111.255')
  })
})
