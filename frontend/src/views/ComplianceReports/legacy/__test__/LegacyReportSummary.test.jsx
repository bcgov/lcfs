// src/views/ComplianceReports/legacy/__test__/LegacyReportSummary.test.jsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import LegacyReportSummary from '../LegacyReportSummary'
import { useGetComplianceReportSummary } from '@/hooks/useComplianceReports'
import {
  renewableFuelColumns,
  lowCarbonColumns,
  nonComplianceColumns
} from '../_schema' // note: one directory up

// Mock the i18n translation hook so that t(key) returns the key
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: {}
  })
}))

// Mock the compliance report hook
vi.mock('@/hooks/useComplianceReports', () => ({
  useGetComplianceReportSummary: vi.fn()
}))

// **Mock the schema module with the correct relative path**
vi.mock('../_schema', () => ({
  renewableFuelColumns: vi.fn(() => []),
  lowCarbonColumns: vi.fn(() => []),
  nonComplianceColumns: vi.fn(() => [])
}))

describe.skip('LegacyReportSummary', () => {
  const reportID = '123'
  const currentStatus = 'active'
  const compliancePeriodYear = '2025'
  let alertRef

  beforeEach(() => {
    // Create a dummy ref with a triggerAlert spy
    alertRef = { current: { triggerAlert: vi.fn() } }
    vi.clearAllMocks()
  })

  it('renders the Loading component when data is loading', () => {
    useGetComplianceReportSummary.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null
    })

    render(<LegacyReportSummary reportID={reportID} alertRef={alertRef} />)

    // The Loading component uses t('report:summaryLoadingMsg') which returns that key.
    expect(screen.getByText('report:summaryLoadingMsg')).toBeInTheDocument()
  })

  it('renders the error state and triggers an alert when there is an error', async () => {
    const errorObj = {
      message: 'Test error message',
      response: { data: { detail: 'Test error detail' } }
    }
    useGetComplianceReportSummary.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: errorObj
    })

    render(<LegacyReportSummary reportID={reportID} alertRef={alertRef} />)

    // Wait for the useEffect to trigger the alert.
    await waitFor(() => {
      expect(alertRef.current.triggerAlert).toHaveBeenCalledWith({
        message: 'Test error detail',
        severity: 'error'
      })
    })

    expect(screen.getByText('report:errorRetrieving')).toBeInTheDocument()
  })

  it('renders summary tables when data is available', async () => {
    // Provide dummy data. Its structure isn’t critical because our schema functions are mocked.
    const data = {
      renewableFuelTargetSummary: [{ id: 1, fuel: 'biofuel' }],
      lowCarbonFuelTargetSummary: [{ id: 2, fuel: 'ethanol' }],
      nonCompliancePenaltySummary: [{ id: 3, penalty: 'fine' }]
    }
    useGetComplianceReportSummary.mockReturnValue({
      data,
      isLoading: false,
      isError: false,
      error: null
    })

    const { container } = render(
      <LegacyReportSummary reportID={reportID} alertRef={alertRef} />
    )

    // Wait for the component to update based on the fetched data.
    await waitFor(() => {
      expect(
        screen.getByText('report:summaryAndDeclaration')
      ).toBeInTheDocument()
    })

    // Verify that the accordion header is rendered.
    expect(screen.getByText('report:summary')).toBeInTheDocument()

    // Instead of checking for title text via getByText, we can check that the table elements are labelled correctly.
    expect(
      screen.getByLabelText('report:part2RenewableFuelTargetSummary table')
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('report:part3LowCarbonFuelTargetSummary table')
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('report:nonCompliancePenaltySummary table')
    ).toBeInTheDocument()

    // Also check that the SummaryTable components are rendered via their data-test attributes.
    const renewableSummary = container.querySelector(
      '[data-test="renewable-summary"]'
    )
    const lowCarbonSummary = container.querySelector(
      '[data-test="low-carbon-summary"]'
    )
    const nonComplianceSummary = container.querySelector(
      '[data-test="non-compliance-summary"]'
    )
    expect(renewableSummary).toBeInTheDocument()
    expect(lowCarbonSummary).toBeInTheDocument()
    expect(nonComplianceSummary).toBeInTheDocument()

    // Verify that the schema functions were called as expected.
    await waitFor(() => {
      expect(renewableFuelColumns).toHaveBeenCalledWith(
        expect.any(Function),
        data.renewableFuelTargetSummary
      )
      expect(lowCarbonColumns).toHaveBeenCalledWith(expect.any(Function))
      expect(nonComplianceColumns).toHaveBeenCalledWith(expect.any(Function))
    })
  })
})
