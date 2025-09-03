import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ScheduleBSummary } from '../ScheduleBSummary.jsx'
import { wrapper } from '@/tests/utils/wrapper'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

// Mock react-router-dom hooks
const mockUseLocation = vi.fn()
const mockUseNavigate = vi.fn()
const mockUseParams = vi.fn()

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockUseNavigate(),
  useParams: () => mockUseParams()
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock BCDataGridServer so we can verify it renders without a full data grid
vi.mock('@/components/BCDataGrid/BCDataGridServer', () => ({
  // Provide a basic mock for both default export and named export
  __esModule: true,
  default: () => (
    <div data-test="mocked-bc-data-grid-server">Mocked BCDataGridServer</div>
  ),
  BCDataGridServer: () => (
    <div data-test="mocked-bc-data-grid-server">Mocked BCDataGridServer</div>
  )
}))

describe('FuelSupplySummary', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    // Default mock returns
    mockUseLocation.mockReturnValue({
      pathname: '/test-fuel-supplies',
      state: {}
    })
    mockUseNavigate.mockReturnValue(vi.fn())
    mockUseParams.mockReturnValue({
      complianceReportId: 'testReportId',
      compliancePeriod: '2024'
    })
  })

  it('renders the component', () => {
    render(
      <ScheduleBSummary
        data={{ fuelSupplies: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )
    // Confirm that BCDataGridServer (the mocked component) is displayed
    expect(screen.getByTestId('mocked-bc-data-grid-server')).toBeInTheDocument()
  })

  it('displays alert message when location.state has a message', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/test-fuel-supplies',
      state: { message: 'Test Alert', severity: 'error' }
    })

    render(
      <ScheduleBSummary
        data={{ fuelSupplies: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // Check that the alert box is rendered with the correct message
    const alertBox = screen.getByTestId('alert-box')
    expect(alertBox).toBeInTheDocument()
    expect(alertBox.textContent).toContain('Test Alert')
  })

  it('does not display alert message if location.state is empty', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/test-fuel-supplies',
      state: {}
    })

    render(
      <ScheduleBSummary
        data={{ fuelSupplies: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // Alert should not be present
    const alertBox = screen.queryByTestId('alert-box')
    expect(alertBox).not.toBeInTheDocument()
  })

  it('renders fuel supplies rows in BCDataGridServer when provided', () => {
    const mockData = {
      fuelSupplies: [
        { fuelSupplyId: 1, fuelType: 'Diesel' },
        { fuelSupplyId: 2, fuelType: 'Gasoline' }
      ]
    }

    render(
      <ScheduleBSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // The actual rows are handled by the BCDataGridServer mock, so just confirm the mock rendered
    expect(screen.getByTestId('mocked-bc-data-grid-server')).toBeInTheDocument()
  })

  it('does nothing special on row click if status is not DRAFT', () => {
    // Here, just ensure that the component renders fine for a non-DRAFT status
    render(
      <ScheduleBSummary data={{ fuelSupplies: [] }} status="SUBMITTED" />,
      { wrapper }
    )
    // Confirm the mock is rendered and no crash occurs
    expect(screen.getByTestId('mocked-bc-data-grid-server')).toBeInTheDocument()
  })
})
