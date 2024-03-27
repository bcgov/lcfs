import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ProgressBreadcrumb from './ProgressBreadcrumb'

describe('ProgressBreadcrumb', () => {
  const steps = ['Draft', 'Sent', 'Submitted', 'Recorded'];

  it('renders without crashing', () => {
    render(<ProgressBreadcrumb steps={steps} currentStep="Sent" />)
    steps.forEach(step => {
      expect(screen.getByText(step)).toBeInTheDocument()
    })
  })

  it('correctly highlights the current step', () => {
    render(<ProgressBreadcrumb steps={steps} currentStep="Sent" />)
    expect(screen.getByText('Sent').parentNode).toHaveStyle('backgroundColor: primary.main')
  })

  it('renders past, and future steps with correct styles', () => {
    render(<ProgressBreadcrumb steps={steps} currentStep="Sent" />)
    expect(screen.getByText('Draft').parentNode).toHaveStyle('backgroundColor: primary.main')
    expect(screen.getByText('Submitted').parentNode).toHaveStyle('backgroundColor: grey.500')
    expect(screen.getByText('Recorded').parentNode).toHaveStyle('backgroundColor: grey.500')
  })
})
