import { describe, expect, it } from 'vitest'

import {
  decideFabricReconnect,
  fabricApiOrigin,
  isFabricInstall,
  isLoopbackApi,
  normalizeFabricApi,
  sameFabricApi,
  savedInferenceFromConfig
} from './control-plane-reconnect'

describe('normalizeFabricApi', () => {
  it('adds /v1 when the origin has no path', () => {
    expect(normalizeFabricApi('https://192.168.1.10:18080')).toBe('https://192.168.1.10:18080/v1')
  })

  it('keeps an existing /v1', () => {
    expect(normalizeFabricApi('https://10.0.0.8:18080/v1/')).toBe('https://10.0.0.8:18080/v1')
  })
})

describe('sameFabricApi', () => {
  it('treats trailing slash as the same plane', () => {
    expect(sameFabricApi('https://10.1.1.5:18080/v1/', 'https://10.1.1.5:18080/v1')).toBe(true)
  })

  it('does not collapse loopback and a WiFi IP', () => {
    expect(sameFabricApi('https://127.0.0.1:18080/v1', 'https://10.1.1.5:18080/v1')).toBe(false)
  })
})

describe('fabricApiOrigin', () => {
  it('strips the /v1 path', () => {
    expect(fabricApiOrigin('https://192.168.1.10:18080/v1')).toBe('https://192.168.1.10:18080')
  })

  it('returns null for garbage', () => {
    expect(fabricApiOrigin('not a url')).toBeNull()
  })
})

describe('savedInferenceFromConfig', () => {
  it('reads model.provider and model.base_url', () => {
    expect(
      savedInferenceFromConfig({
        model: { provider: 'custom', base_url: 'https://10.1.1.5:18080/v1' }
      })
    ).toEqual({ provider: 'custom', baseUrl: 'https://10.1.1.5:18080/v1' })
  })

  it('falls back to providers.<name>.base_url', () => {
    expect(
      savedInferenceFromConfig({
        model: { provider: 'garvit' },
        providers: { garvit: { base_url: 'https://10.179.222.111:8090/v1' } }
      })
    ).toEqual({ provider: 'garvit', baseUrl: 'https://10.179.222.111:8090/v1' })
  })

  it('returns null when neither provider nor URL is set', () => {
    expect(savedInferenceFromConfig({})).toBeNull()
  })
})

describe('isFabricInstall', () => {
  it('treats custom / houdry as fabric', () => {
    expect(isFabricInstall({ provider: 'custom', baseUrl: 'https://127.0.0.1:18080/v1' })).toBe(true)
    expect(isFabricInstall({ provider: 'houdry', baseUrl: '' })).toBe(true)
  })

  it('treats a named LAN provider as fabric', () => {
    expect(isFabricInstall({ provider: 'garvit', baseUrl: 'https://10.179.222.111:8090/v1' })).toBe(true)
  })

  it('does not treat Azure as fabric', () => {
    expect(isFabricInstall({ provider: 'azure', baseUrl: '' })).toBe(false)
    expect(isFabricInstall({ provider: 'azure-foundry', baseUrl: 'https://127.0.0.1:18080/v1' })).toBe(false)
  })
})

describe('isLoopbackApi', () => {
  it('flags 127.0.0.1 and localhost', () => {
    expect(isLoopbackApi('https://127.0.0.1:18080/v1')).toBe(true)
    expect(isLoopbackApi('http://localhost:18080/v1')).toBe(true)
  })

  it('does not flag a LAN address', () => {
    expect(isLoopbackApi('https://192.168.1.10:18080/v1')).toBe(false)
  })
})

describe('decideFabricReconnect', () => {
  it('adopts a discovered plane on first run', () => {
    expect(
      decideFabricReconnect({
        configured: false,
        discoveredApi: 'https://192.168.1.10:18080/v1',
        saved: null,
        savedLoaded: false,
        savedReachable: false
      })
    ).toEqual({ action: 'adopt', api: 'https://192.168.1.10:18080/v1' })
  })

  it('retries first run while nothing answers', () => {
    expect(
      decideFabricReconnect({
        configured: false,
        discoveredApi: null,
        saved: null,
        savedLoaded: false,
        savedReachable: false
      })
    ).toEqual({ action: 'retry' })
  })

  it('waits for config before rewriting a configured install', () => {
    expect(
      decideFabricReconnect({
        configured: true,
        discoveredApi: 'https://10.0.0.8:18080/v1',
        saved: null,
        savedLoaded: false,
        savedReachable: false
      })
    ).toEqual({ action: 'retry' })
  })

  it('does not guess fabric when config has not parsed yet', () => {
    expect(
      decideFabricReconnect({
        configured: true,
        discoveredApi: 'https://10.0.0.8:18080/v1',
        saved: null,
        savedLoaded: true,
        savedReachable: false
      })
    ).toEqual({ action: 'retry' })
  })

  it('never rewrites Azure', () => {
    expect(
      decideFabricReconnect({
        configured: true,
        discoveredApi: 'https://10.0.0.8:18080/v1',
        saved: { provider: 'azure', baseUrl: '' },
        savedLoaded: true,
        savedReachable: false
      })
    ).toEqual({ action: 'skip' })
  })

  it('keeps a fabric URL that still answers, even if WiFi also advertised another', () => {
    expect(
      decideFabricReconnect({
        configured: true,
        discoveredApi: 'https://10.0.0.9:18080/v1',
        saved: { provider: 'custom', baseUrl: 'https://10.0.0.8:18080/v1' },
        savedLoaded: true,
        savedReachable: true
      })
    ).toEqual({ action: 'keep', api: 'https://10.0.0.8:18080/v1' })
  })

  it('adopts the new WiFi IP when the saved fabric URL is dead', () => {
    expect(
      decideFabricReconnect({
        configured: true,
        discoveredApi: 'https://192.168.29.10:18080/v1',
        saved: { provider: 'custom', baseUrl: 'https://10.179.222.111:8090/v1' },
        savedLoaded: true,
        savedReachable: false
      })
    ).toEqual({ action: 'adopt', api: 'https://192.168.29.10:18080/v1' })
  })

  it('retries when the saved fabric URL is dead and nothing is on this WiFi yet', () => {
    expect(
      decideFabricReconnect({
        configured: true,
        discoveredApi: null,
        saved: { provider: 'custom', baseUrl: 'https://10.179.222.111:8090/v1' },
        savedLoaded: true,
        savedReachable: false
      })
    ).toEqual({ action: 'retry' })
  })

  it('never keeps a loopback saved URL, even when it still answers', () => {
    expect(
      decideFabricReconnect({
        configured: true,
        discoveredApi: null,
        saved: { provider: 'custom', baseUrl: 'https://127.0.0.1:18080/v1' },
        savedLoaded: true,
        savedReachable: true
      })
    ).toEqual({ action: 'retry' })
  })

  it('adopts a WiFi hit over a still-reachable loopback saved URL', () => {
    expect(
      decideFabricReconnect({
        configured: true,
        discoveredApi: 'https://192.168.1.10:18080/v1',
        saved: { provider: 'custom', baseUrl: 'https://127.0.0.1:18080/v1' },
        savedLoaded: true,
        savedReachable: true
      })
    ).toEqual({ action: 'adopt', api: 'https://192.168.1.10:18080/v1' })
  })
})
