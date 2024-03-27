import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import DisclaimerBanner from './DisclaimerBanner'

describe('DisclaimerBanner', () => {
  it('renders the messages', () => {
    render(<DisclaimerBanner messages={['Test Message 1', 'Test Message 2']} />)

    // Check if both messages are present
    expect(screen.getByText('Test Message 1')).toBeInTheDocument()
    expect(screen.getByText('Test Message 2')).toBeInTheDocument()
  })
})
