import { describe, expect, it } from 'vitest'

import {
  displayNameFor,
  fabricHost,
  fabricLanKind,
  fromLoopbackHit,
  fromWifiAdvertise,
  mergeFabricLanScan,
  shouldAdoptDiscoveredUrl,
  uniqueFabricLan
} from './houdry-fabric-lan'

describe('fabricHost', () => {
  it('extracts host:port', () => {
    expect(fabricHost('http://192.168.1.10:8080/v1')).toBe('192.168.1.10:8080')
  })

  it('keeps the raw string when the URL will not parse', () => {
    expect(fabricHost('not a url')).toBe('not a url')
  })
})

describe('fabricLanKind', () => {
  it('maps count to none / one / many', () => {
    expect(fabricLanKind(0)).toBe('none')
    expect(fabricLanKind(1)).toBe('one')
    expect(fabricLanKind(2)).toBe('many')
  })
})

describe('shouldAdoptDiscoveredUrl', () => {
  const placeholder = 'http://127.0.0.1:18080/v1'

  it('adopts into an empty or placeholder field', () => {
    expect(shouldAdoptDiscoveredUrl('', placeholder)).toBe(true)
    expect(shouldAdoptDiscoveredUrl(placeholder, placeholder)).toBe(true)
  })

  it('does not overwrite a URL the user typed', () => {
    expect(shouldAdoptDiscoveredUrl('http://10.0.0.8:8080/v1', placeholder)).toBe(false)
  })
})

describe('mergeFabricLanScan', () => {
  it('uses this computer when loopback answers, even if WiFi also advertised', () => {
    const wifi = fromWifiAdvertise({
      api: 'http://172.24.110.66:8090/v1',
      auth: false,
      name: 'houdry-Lethal_laptop-8090',
      openai: true,
      url: 'http://172.24.110.66:8090'
    })

    const out = mergeFabricLanScan([wifi], 'http://127.0.0.1:8090/v1')

    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      api: 'http://127.0.0.1:8090/v1',
      source: 'this-computer'
    })
  })

  it('keeps WiFi ads when this computer is not serving', () => {
    const wifi = fromWifiAdvertise({
      api: 'http://192.168.1.10:8080/v1',
      auth: false,
      name: 'houdry-lab',
      openai: true,
      url: 'http://192.168.1.10:8080'
    })

    expect(mergeFabricLanScan([wifi], null).map(ep => ep.api)).toEqual(['http://192.168.1.10:8080/v1'])
  })
})

describe('uniqueFabricLan', () => {
  it('keeps the first of each API URL', () => {
    const a = fromWifiAdvertise({
      api: 'http://a:8080/v1',
      auth: false,
      name: 'first',
      openai: true,
      url: 'http://a:8080'
    })

    const b = fromWifiAdvertise({
      api: 'http://a:8080/v1',
      auth: false,
      name: 'second',
      openai: true,
      url: 'http://a:8080'
    })

    expect(uniqueFabricLan([a, b]).map(ep => ep.name)).toEqual(['first'])
  })

  it('collapses one control plane advertised on WiFi and WSL', () => {
    const wifi = fromWifiAdvertise({
      api: 'http://192.168.29.179:8090/v1',
      auth: false,
      name: 'houdry-Lethal_laptop-8090',
      openai: true,
      url: 'http://192.168.29.179:8090'
    })

    const wsl = fromWifiAdvertise({
      api: 'http://172.23.96.1:8090/v1',
      auth: false,
      name: 'houdry-Lethal_laptop-8090',
      openai: true,
      url: 'http://172.23.96.1:8090'
    })

    const out = uniqueFabricLan([wsl, wifi])

    expect(out).toHaveLength(1)
    expect(out[0].host).toBe('192.168.29.179:8090')
  })
})

describe('displayNameFor', () => {
  it('labels loopback as this computer', () => {
    expect(displayNameFor(fromLoopbackHit('http://127.0.0.1:8080/v1'), 'This computer')).toBe('This computer')
  })

  it('falls back to the host when WiFi did not send a name', () => {
    const ep = fromWifiAdvertise({
      api: 'http://192.168.1.10:8080/v1',
      auth: false,
      name: '',
      openai: true,
      url: 'http://192.168.1.10:8080'
    })

    expect(displayNameFor(ep, 'This computer')).toBe('192.168.1.10:8080')
  })
})
