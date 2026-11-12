import { test } from '@/tests/utils/fixtures'
import 'react'
import { afterEach, describe, expect, vi } from 'vite-plus/test'
import { cleanup, fireEvent, screen } from '@testing-library/react'

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
  default: () => (
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

  test('shows the organization confirmation note only when requested (BCeID users)', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const withAddress = {
      ...baseApplication,
      organization: {
        name: 'Fuel Producer Ltd.',
        orgAddress: {
          streetAddress: '697 Sarmiento',
          city: 'San Martin',
          provinceState: 'Santa Fe',
          country: 'Argentina'
        }
      }
    }
    const { unmount } = render(
      <ApplicationSummary
        ciApplication={withAddress}
        showOrgInfoConfirmation
      />,
      [query, theme, localization, router]
    )
    expect(
      screen.getByTestId('ci-summary-org-info-confirmation')
    ).toBeInTheDocument()
    unmount()

    render(<ApplicationSummary ciApplication={withAddress} />, [
      query,
      theme,
      localization,
      router
    ])
    expect(screen.queryByTestId('ci-summary-org-info-confirmation')).toBeNull()
  })

  test('lists the facility process flow diagram alongside application documents', ({
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
          fuelProductionFacilityId: 4,
          fuelProductionFacility: {
            fuelProductionFacilityId: 4,
            name: 'Test facility',
            documents: [
              { documentId: 9, fileName: 'process-flow.pdf', fileSize: 2048 }
            ]
          },
          documents: [{ documentId: 1, fileName: 'tech.pdf', fileSize: 100 }]
        }}
      />,
      [query, theme, localization, router]
    )

    const card = screen.getByTestId('ci-summary-documents')
    expect(card).toHaveTextContent('tech.pdf')
    expect(
      screen.getByTestId('ci-summary-facility-documents-header')
    ).toHaveTextContent('carbonIntensity:summary.processFlowDiagramHeader')
    const facilityRow = screen.getByTestId('ci-summary-facility-document-row')
    expect(facilityRow).toHaveTextContent('process-flow.pdf')

    fireEvent.click(screen.getByText('process-flow.pdf'))
    expect(mockDownloadDocument).toHaveBeenCalledWith(9, 'process-flow.pdf')
  })

  test('omits the facility diagram section when the facility has no documents', ({
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
          fuelProductionFacilityId: 4,
          fuelProductionFacility: { fuelProductionFacilityId: 4, documents: [] }
        }}
      />,
      [query, theme, localization, router]
    )
    expect(
      screen.queryByTestId('ci-summary-facility-documents-header')
    ).toBeNull()
  })

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

  for (const pathwayDescription of [null, '', '   ']) {
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
