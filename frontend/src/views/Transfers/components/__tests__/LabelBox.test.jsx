import React from 'react'
import { render, screen } from '@testing-library/react'
import { LabelBox } from '../LabelBox'
import { wrapper } from '@/tests/utils/wrapper.jsx'

describe('LabelBox', () => {
  test('renders correctly with label and description', () => {
    render(
      <LabelBox label="Test Label" description="Test Description">
        <div>Child Content</div>
      </LabelBox>,
      { wrapper }
    )
    expect(screen.getByText('Test Label')).toBeInTheDocument()
    expect(screen.getByText('Test Description')).toBeInTheDocument()
    expect(screen.getByText('Child Content')).toBeInTheDocument()
  })

  test('renders children correctly', () => {
    render(
      <LabelBox label="Test Label" description="Test Description">
        <div>Child Content</div>
      </LabelBox>,
      { wrapper }
    )
    expect(screen.getByText('Child Content')).toBeInTheDocument()
  })

  test('does not render label or description when not provided', () => {
    render(
      <LabelBox>
        <div>Child Content</div>
      </LabelBox>,
      { wrapper }
    )
    expect(screen.queryByText('Child Content')).toBeInTheDocument()
    expect(screen.queryByText('Test Label')).not.toBeInTheDocument()
    expect(screen.queryByText('Test Description')).not.toBeInTheDocument()
  })
})
