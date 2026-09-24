import React from 'react'
import { afterEach, describe, expect, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

import { test } from '@/tests/utils/fixtures'
import { ApplicationSummary } from '@/views/CarbonIntensity/components/ApplicationSummary'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

const mockDownloadDocument = vi.fn()
vi.mock('@/hooks/useDocuments', () => ({
  useDownloadDocument: () => mockDownloadDocument
}))

vi.mock('@/components/Documents/DocumentPreviewButton', () => ({
  __esModule: true,
  default: ({ document }) => (
    <button type="button" data-test="document-preview-button">
      Preview document
    </button>
  )
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

  test('downloads an un-renamed document using its original file name', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <ApplicationSummary
        ciApplication={{
          ...baseApplication,
          documents: [{ documentId: 1, fileName: 'tech.pdf', fileSize: 100 }]
        }}
      />,
      [query, theme, localization, router]
    )

    fireEvent.click(screen.getByText('tech.pdf'))
    expect(mockDownloadDocument).toHaveBeenCalledWith(1, 'tech.pdf')
  })

  test('downloads a renamed document using its display name', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <ApplicationSummary
        ciApplication={{
          ...baseApplication,
          documents: [
            {
              documentId: 2,
              fileName: 'tech.pdf',
              displayName: 'My Report.pdf',
              fileSize: 100
            }
          ]
        }}
      />,
      [query, theme, localization, router]
    )

    fireEvent.click(screen.getByText('My Report.pdf'))
    expect(mockDownloadDocument).toHaveBeenCalledWith(2, 'My Report.pdf')
  })

  test('displays the pathway description above the pathway content', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <ApplicationSummary
        ciApplication={{
          ...baseApplication,
          pathwayDescription: 'Uses carbon capture and sequestration.'
        }}
      />,
      [query, theme, localization, router]
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

  const pathwayDescriptionCases = [null, '', '   ']
  for (const pathwayDescription of pathwayDescriptionCases) {
    test(`does not display the pathway description when its value is ${JSON.stringify(pathwayDescription)}`, ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <ApplicationSummary
          ciApplication={{ ...baseApplication, pathwayDescription }}
        />,
        [query, theme, localization, router]
      )

      expect(
        screen.queryByTestId('ci-summary-pathway-description')
      ).not.toBeInTheDocument()
    })
  }

  test('displays analyst assignment history with previous and new analysts', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
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
      [query, theme, localization, router]
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

  test('does not expose assignment history when it is omitted from the response', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ApplicationSummary ciApplication={baseApplication} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(
      screen.queryByTestId('ci-summary-assignment-history')
    ).not.toBeInTheDocument()
  })
})
