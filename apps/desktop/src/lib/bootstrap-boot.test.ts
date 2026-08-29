import { describe, expect, it } from 'vitest'

import { isBootstrapBootError } from './bootstrap-boot'

describe('isBootstrapBootError', () => {
  it('matches latched bootstrap failures from main', () => {
    expect(isBootstrapBootError("Hermes bootstrap failed at stage 'dependencies': syntax check")).toBe(true)
    expect(isBootstrapBootError('Hermes install was cancelled.')).toBe(true)
    expect(isBootstrapBootError('Hermes recovery was handed off to Hermes Setup.')).toBe(true)
  })

  it('does not match ordinary boot failures', () => {
    expect(isBootstrapBootError('Timed out connecting to Hermes backend')).toBe(false)
    expect(isBootstrapBootError('Desktop boot failed: 401')).toBe(false)
  })
})
