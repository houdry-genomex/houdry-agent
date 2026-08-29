import { describe, expect, it } from 'vitest'

import { isHoudryDesktopSidebarNavId, isHoudryHiddenWorkspacePath } from './houdry-desktop-surface'

describe('houdry desktop chrome', () => {
  it('hides the Messaging workspace page', () => {
    expect(isHoudryHiddenWorkspacePath('/messaging')).toBe(true)
    expect(isHoudryHiddenWorkspacePath('/messaging/')).toBe(true)
    expect(isHoudryHiddenWorkspacePath('/messaging?platform=telegram')).toBe(true)
    expect(isHoudryHiddenWorkspacePath('/skills')).toBe(false)
    expect(isHoudryHiddenWorkspacePath('/artifacts')).toBe(false)
    expect(isHoudryHiddenWorkspacePath('/')).toBe(false)
  })

  it('drops Messaging from the sidebar rail', () => {
    expect(isHoudryDesktopSidebarNavId('messaging')).toBe(false)
    expect(isHoudryDesktopSidebarNavId('skills')).toBe(true)
    expect(isHoudryDesktopSidebarNavId('artifacts')).toBe(true)
    expect(isHoudryDesktopSidebarNavId('cron')).toBe(true)
    expect(isHoudryDesktopSidebarNavId('new-session')).toBe(true)
  })
})
