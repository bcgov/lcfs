import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReviewSections } from '../ReviewSections'
import type { ReviewSection } from '../types'

const sections: ReviewSection[] = [
  {
    section: 'Electricity/FSE',
    status: 'review',
    findings: [
      {
        reviewArea: 'Electricity/FSE',
        severity: 'review',
        title: 'FSE validation status needs review',
        detail: 'One or more reported FSE rows are not in validated status.',
        source: 'FSE reporting view',
        evidence: [{ label: 'Validated FSE', value: 2, comparisonValue: 3 }],
        suggestedFollowUp: 'Which FSE rows are not validated?',
        confidence: 'high'
      }
    ]
  },
  {
    section: 'Administrative completeness',
    status: 'clear',
    findings: [
      {
        reviewArea: 'Administrative completeness',
        severity: 'informational',
        title: 'Original report submitted on time',
        detail: 'The report was submitted before March 31.',
        source: 'Compliance report',
        evidence: [{ label: 'Submitted date', value: '2026-03-30' }],
        confidence: 'high'
      }
    ]
  }
]

describe('ReviewSections', () => {
  it('renders findings and lets analysts mark actionable findings addressed', async () => {
    const toggleFindingAddressed = vi.fn()
    const user = userEvent.setup()

    render(
      <ReviewSections
        sections={sections}
        expandedSection="Electricity/FSE"
        setExpandedSection={vi.fn()}
        addressedFindingIds={new Set()}
        toggleFindingAddressed={toggleFindingAddressed}
      />
    )

    expect(
      screen.getByText('FSE validation status needs review')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Validated FSE: 2 | comparison 3')
    ).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /addressed/i }))

    expect(toggleFindingAddressed).toHaveBeenCalledWith(
      'Electricity/FSE|review|FSE reporting view|FSE validation status needs review|0'
    )
  })

  it('uses an informational badge when a section only has informational findings', () => {
    render(
      <ReviewSections
        sections={sections}
        expandedSection="Administrative completeness"
        setExpandedSection={vi.fn()}
        addressedFindingIds={new Set()}
        toggleFindingAddressed={vi.fn()}
      />
    )

    expect(screen.getAllByText('informational').length).toBeGreaterThan(0)
    expect(
      screen.getByText('Original report submitted on time')
    ).toBeInTheDocument()
  })
})
