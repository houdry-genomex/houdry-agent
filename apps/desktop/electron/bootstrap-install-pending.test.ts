import { describe, expect, it } from 'vitest'

import { isBootstrapInstallPending } from './bootstrap-install-pending'

describe('isBootstrapInstallPending', () => {
  it('is true while bootstrap stages are running', () => {
    expect(isBootstrapInstallPending({ bootstrapActive: true, runtimeUsable: false })).toBe(true)
    expect(isBootstrapInstallPending({ bootstrapActive: true, runtimeUsable: true })).toBe(true)
  })

  it('is true when the local runtime is not usable yet', () => {
    expect(isBootstrapInstallPending({ bootstrapActive: false, runtimeUsable: false })).toBe(true)
  })

  it('is false once the runtime is usable and bootstrap is idle', () => {
    expect(isBootstrapInstallPending({ bootstrapActive: false, runtimeUsable: true })).toBe(false)
  })
})
