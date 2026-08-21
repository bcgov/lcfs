import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { wrapper } from '@/tests/utils/wrapper'
import { ApplicationSummary } from '@/views/CarbonIntensity/components/ApplicationSummary'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('@/hooks/useDocuments', () => ({
  useDownloadDocument: () => vi.fn()
}))

vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: () => <div data-test="grid-stub" />
}))

vi.mock('@/views/CarbonIntensity/components/_step2Schema', () => ({
  ciApplicationPathwayChangelogColDefs: () => [],
  ciApplicationPathwaySummaryColDefs: () => []
}))

vi.mock('@/utils/formatters', () => ({
  formatDateWithTimezoneAbbr: (date) => `Formatted: ${date}`
}))

const baseApplication = {
  ciApplicationId: 99,
  documents: [],
  organization: {},
  pathways: []
}

describe('ApplicationSummary', () => {
  afterEach(cleanup)

  it('displays the pathway description above the pathway content', () => {
    render(
      <ApplicationSummary
        ciApplication={{
          ...baseApplication,
          pathwayDescription: 'Uses carbon capture and sequestration.'
        }}
      />,
      { wrapper }
    )

    const description = screen.getByTestId('ci-summary-pathway-description')
    expect(description).toHaveTextContent(
      'carbonIntensity:step2.descriptionLabel'
    )
    expect(description).toHaveTextContent(
      'Uses carbon capture and sequestration.'
    )
    const pathwaysHeader = screen.getByText(
      'carbonIntensity:summary.pathwaysHeader'
    )
    expect(
      description.compareDocumentPosition(pathwaysHeader) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it.each([null, '', '   '])(
    'does not display the pathway description when its value is %p',
    (pathwayDescription) => {
      render(
        <ApplicationSummary
          ciApplication={{ ...baseApplication, pathwayDescription }}
        />,
        { wrapper }
      )

      expect(
        screen.queryByTestId('ci-summary-pathway-description')
      ).not.toBeInTheDocument()
    }
  )

  it('displays analyst assignment history with previous and new analysts', () => {
    render(
      <ApplicationSummary
        ciApplication={{
          ...baseApplication,
          assignmentHistory: [
            {
              event: 'analyst_reassigned',
              changedAt: '2026-08-19T18:45:00Z',
              changedBy: 'Casey Reviewer',
              previousAnalyst: { fullName: 'Alex Analyst' },
              newAnalyst: { fullName: 'Sam Analyst' }
            },
            {
              event: 'analyst_assigned',
              changedAt: '2026-08-18T17:30:00Z',
              changedBy: 'Casey Reviewer',
              previousAnalyst: null,
              newAnalyst: { fullName: 'Alex Analyst' }
            }
          ]
        }}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('ci-summary-assignment-history')).toBeVisible()
    expect(screen.getByTestId('ci-assignment-history-divider')).toBeVisible()
    expect(
      screen.getAllByTestId('ci-summary-assignment-history-row')
    ).toHaveLength(2)
    expect(screen.getAllByText('Alex Analyst')).toHaveLength(2)
    expect(screen.getByText('Sam Analyst')).toBeVisible()
    expect(screen.getByText('carbonIntensity:summary.unassigned')).toBeVisible()
    expect(screen.getAllByText('Casey Reviewer')).toHaveLength(2)
    expect(screen.getByRole('list')).toBeVisible()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(
      screen.getAllByTestId('ci-summary-assignment-history-row')[0]
    ).toHaveTextContent('Formatted: 2026-08-19T18:45:00Z')
  })

  it('does not expose assignment history when it is omitted from the response', () => {
    render(<ApplicationSummary ciApplication={baseApplication} />, { wrapper })

    expect(
      screen.queryByTestId('ci-summary-assignment-history')
    ).not.toBeInTheDocument()
  })
})
