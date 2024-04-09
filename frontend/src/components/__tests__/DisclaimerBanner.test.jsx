import DisclaimerBanner from '@/components/DisclaimerBanner'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('DisclaimerBanner', () => {
  it('renders the messages', () => {
    render(<DisclaimerBanner messages={['Test Message 1', 'Test Message 2']} />)

    // Check if both messages are present
    expect(screen.getByText('Test Message 1')).toBeInTheDocument()
    expect(screen.getByText('Test Message 2')).toBeInTheDocument()
  })
})
