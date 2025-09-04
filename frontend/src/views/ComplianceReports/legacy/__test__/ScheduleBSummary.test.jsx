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

  it('renders component without deprecated grid regardless of data provided', () => {
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
  
  })
})
