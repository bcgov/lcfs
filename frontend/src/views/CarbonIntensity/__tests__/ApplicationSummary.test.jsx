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
})
