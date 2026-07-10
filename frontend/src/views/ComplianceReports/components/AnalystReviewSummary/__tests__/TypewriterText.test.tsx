import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TypewriterText } from '../TypewriterText'

describe('TypewriterText', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders inactive text immediately', () => {
    render(<TypewriterText text="Administrative completeness" active={false} />)

    expect(screen.getByText('Administrative completeness')).toBeInTheDocument()
  })

  it('types active text over time', () => {
    vi.useFakeTimers()

    render(<TypewriterText text="FSE review" delay={10} />)

    expect(screen.queryByText('FSE review')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(60)
    })

    expect(screen.getByText('FSE review')).toBeInTheDocument()
  })
})
