import { describe, expect, it } from 'vitest'

import { fabricHttpsApi, fabricHttpsOrigin, rewriteHoudryHttps } from './houdry-tls'

describe('rewriteHoudryHttps', () => {
  it('upgrades http control-plane URLs', () => {
    expect(rewriteHoudryHttps('http://127.0.0.1:18080/')).toBe('https://127.0.0.1:18080')
    expect(rewriteHoudryHttps('http://10.1.1.5:8090/v1')).toBe('https://10.1.1.5:8090/v1')
  })

  it('leaves https and non-http strings alone', () => {
    expect(rewriteHoudryHttps('https://127.0.0.1:18080')).toBe('https://127.0.0.1:18080')
    expect(rewriteHoudryHttps('not a url')).toBe('not a url')
  })
})

describe('fabricHttps helpers', () => {
  it('build loopback https origins', () => {
    expect(fabricHttpsOrigin(18_080)).toBe('https://127.0.0.1:18080')
    expect(fabricHttpsApi(18_080)).toBe('https://127.0.0.1:18080/v1')
  })
})
