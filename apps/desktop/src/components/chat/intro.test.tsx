import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Intro } from './intro'

describe('chat intro', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the Houdry Agent wordmark and MRPL slash skills', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<Intro personality="none" seed={0} />)

    expect(screen.getByLabelText('HOUDRY AGENT')).toBeTruthy()
    expect(screen.getByText(/\/document-analysis/)).toBeTruthy()
    expect(screen.getByText(/EXECUTE stays locked/)).toBeTruthy()
  })
})
