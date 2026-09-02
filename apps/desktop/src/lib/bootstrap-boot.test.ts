import { describe, expect, it } from 'vitest'

import { isBootstrapBootError } from './bootstrap-boot'

describe('isBootstrapBootError', () => {
  it('matches latched bootstrap failures from main', () => {
    expect(isBootstrapBootError("Houdry bootstrap failed at stage 'dependencies': syntax check")).toBe(true)
    expect(isBootstrapBootError('Houdry install was cancelled.')).toBe(true)
    expect(isBootstrapBootError('Houdry recovery was handed off to Houdry Setup.')).toBe(true)
  })

  it('does not match ordinary boot failures', () => {
    expect(isBootstrapBootError('Timed out connecting to Houdry backend')).toBe(false)
    expect(isBootstrapBootError('Desktop boot failed: 401')).toBe(false)
  })
})
