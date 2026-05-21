import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import {
  buildCIWorkflowSteps,
  CI_APPLICATION_STEPS,
  CIApplicationProgress,
  getCIWorkflowConnectorStyle
} from '@/views/CarbonIntensity/components/CIApplicationProgress'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

describe('CIApplicationProgress', () => {
  afterEach(cleanup)

  it('exposes the canonical 5-step list', () => {
    expect(CI_APPLICATION_STEPS).toHaveLength(5)
    expect(CI_APPLICATION_STEPS.map((s) => s.key)).toEqual([
      'step1',
      'step2',
      'step3',
      'step4',
      'step5'
    ])
  })

  it('renders all step labels', () => {
    render(<CIApplicationProgress activeStep={0} />, { wrapper })
    expect(screen.getByText('carbonIntensity:steps.step1')).toBeInTheDocument()
    expect(screen.getByText('carbonIntensity:steps.step2')).toBeInTheDocument()
    expect(screen.getByText('carbonIntensity:steps.step5')).toBeInTheDocument()
  })

  it('marks the active step with Mui-active styling', () => {
    render(<CIApplicationProgress activeStep={2} />, {
      wrapper
    })
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('builds low risk workflow without verification 2', () => {
    const steps = buildCIWorkflowSteps({
      status: { status: 'Submitted' },
      signatureUser: 'Jane Submitter',
      signatureDateTime: '2026-05-01T12:00:00Z',
      preliminaryRiskAssessment: 'Low',
      verification1Date: '2026-05-02T12:00:00Z',
      proposedFuelCodeEffectiveDate: '2026-06-01'
    })
    expect(steps.map((step) => step.key)).toEqual([
      'submitted',
      'verification1',
      'target'
    ])
  })

  it('renders submitted workflow details and target countdown', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-19T12:00:00Z'))
    render(
      <CIApplicationProgress
        ciApplication={{
          status: { status: 'Submitted' },
          signatureUserDisplayName: 'Jane Submitter',
          signatureDateTime: '2026-05-01T12:00:00Z',
          preliminaryRiskAssessment: 'Medium',
          assignedAnalyst: {
            initials: 'AA',
            fullName: 'Alex Analyst'
          },
          proposedFuelCodeEffectiveDate: '2026-06-01'
        }}
      />,
      { wrapper }
    )

    expect(screen.getByText('Submitted')).toBeInTheDocument()
    expect(screen.getByText('JS')).toBeInTheDocument()
    expect(screen.getByText('Verification 2')).toBeInTheDocument()
    expect(screen.getByText('Proposed effective date')).toBeInTheDocument()
    expect(screen.getByText('13 days remaining')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('uses solid connectors only between completed workflow steps', () => {
    expect(
      getCIWorkflowConnectorStyle(
        { state: 'completed' },
        { state: 'completed' }
      )
    ).toBe('solid')
    expect(
      getCIWorkflowConnectorStyle({ state: 'completed' }, { state: 'target' })
    ).toBe('dotted')
    expect(
      getCIWorkflowConnectorStyle({ state: 'pending' }, { state: 'completed' })
    ).toBe('dotted')
  })
})
