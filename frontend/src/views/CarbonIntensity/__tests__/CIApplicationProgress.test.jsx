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

let mockHasAnyRole = vi.fn(() => true)
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    hasAnyRole: mockHasAnyRole
  })
}))

describe('CIApplicationProgress', () => {
  afterEach(() => {
    cleanup()
    mockHasAnyRole = vi.fn(() => true)
  })

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

  it('hides verification workflow steps for external users until approval', () => {
    mockHasAnyRole = vi.fn(() => false)
    const steps = buildCIWorkflowSteps(
      {
        status: { status: 'Recommended' },
        signatureUserDisplayName: 'Jane Submitter',
        signatureDateTime: '2026-05-01T12:00:00Z',
        preliminaryRiskAssessment: 'High',
        verification1Date: '2026-05-02T12:00:00Z',
        verification2Date: '2026-05-03T12:00:00Z',
        recommendationDate: '2026-05-04T12:00:00Z',
        proposedFuelCodeEffectiveDate: '2026-06-01'
      },
      { showInternalSteps: false }
    )

    expect(steps.map((step) => step.key)).toEqual(['submitted', 'target'])
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

  it('uses the acting user for a completed verification step instead of the assigned analyst', () => {
    const steps = buildCIWorkflowSteps({
      status: { status: 'Submitted' },
      signatureUserDisplayName: 'Jane Submitter',
      signatureDateTime: '2026-05-01T12:00:00Z',
      preliminaryRiskAssessment: 'Low',
      verification1Date: '2026-05-02T12:00:00Z',
      verification1User: {
        initials: 'GW',
        fullName: 'Grace Worker'
      },
      assignedAnalyst: {
        initials: 'AA',
        fullName: 'Alex Analyst'
      },
      proposedFuelCodeEffectiveDate: '2026-06-01'
    })

    expect(steps.find((step) => step.key === 'verification1')).toMatchObject({
      initials: 'GW',
      tooltip: 'Grace Worker',
      state: 'completed'
    })
  })

  it('uses the assigned analyst only for pending verification steps', () => {
    const steps = buildCIWorkflowSteps({
      status: { status: 'Submitted' },
      signatureUserDisplayName: 'Jane Submitter',
      signatureDateTime: '2026-05-01T12:00:00Z',
      preliminaryRiskAssessment: 'Medium',
      verification1Date: '2026-05-02T12:00:00Z',
      verification1User: {
        initials: 'GW',
        fullName: 'Grace Worker'
      },
      assignedAnalyst: {
        initials: 'AA',
        fullName: 'Alex Analyst'
      },
      proposedFuelCodeEffectiveDate: '2026-06-01'
    })

    expect(steps.find((step) => step.key === 'verification2')).toMatchObject({
      initials: 'AA',
      tooltip: 'Alex Analyst',
      state: 'pending'
    })
  })

  it('shows a withdrawn terminal step instead of the target icon', () => {
    const steps = buildCIWorkflowSteps({
      status: { status: 'Withdrawn' },
      signatureUserDisplayName: 'Jane Submitter',
      signatureDateTime: '2026-05-01T12:00:00Z',
      updateDate: '2026-05-22T12:00:00Z',
      proposedFuelCodeEffectiveDate: '2026-06-01'
    })

    expect(steps.map((step) => step.key)).toContain('withdrawn')
    expect(steps.map((step) => step.key)).not.toContain('target')
    expect(steps.at(-1)).toMatchObject({
      key: 'withdrawn',
      label: 'Withdrawn',
      icon: 'close',
      state: 'completed'
    })
  })
})
