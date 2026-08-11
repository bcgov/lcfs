import React from 'react'
import { afterEach, describe, expect, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'

import { test } from '@/tests/utils/fixtures'
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

const baseApplication = {
  ciApplicationId: 99,
  documents: [],
  organization: {},
  pathways: []
}

describe('ApplicationSummary', () => {
  afterEach(cleanup)

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
})
