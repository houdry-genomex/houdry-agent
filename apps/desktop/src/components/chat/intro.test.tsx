import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { requestComposerFocus, requestComposerInsert } from '@/app/chat/composer/focus'

import { Intro } from './intro'

vi.mock('@/app/chat/composer/focus', () => ({
  requestComposerFocus: vi.fn(),
  requestComposerInsert: vi.fn()
}))

describe('chat intro', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('shows a sentence-case display headline and starter tiles, not a skill dump', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<Intro personality="none" seed={0} />)

    const headline = screen.getByRole('heading', { level: 1, name: 'Houdry Agent is ready.' })
    expect(headline.tagName).toBe('H1')
    expect(headline.className).not.toMatch(/Collapse/)
    expect(headline.className).not.toMatch(/uppercase/)
    expect(screen.getByRole('button', { name: 'Analyze an inspection document' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Look up an inspection procedure' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Run an engineering calculation' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Search the knowledge base' })).toBeTruthy()
    expect(screen.queryByText(/EXECUTE stays locked/)).toBeNull()
    expect(screen.queryByText(/\/document-analysis/)).toBeNull()
  })

  it('inserts a slash skill into the composer from a starter tile', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<Intro personality="none" seed={0} />)

    fireEvent.click(screen.getByRole('button', { name: 'Look up an inspection procedure' }))

    expect(requestComposerInsert).toHaveBeenCalledWith('/procedure-lookup', { mode: 'prefix' })
    expect(requestComposerFocus).toHaveBeenCalledWith('active')
  })
})
