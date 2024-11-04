import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ImportantInfoCard } from '../ImportantInfoCard'
import { useCreateSupplementalReport } from '@/hooks/useComplianceReports'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { wrapper } from '@/tests/utils/wrapper'

// Mock the necessary modules
vi.mock('@/hooks/useComplianceReports')
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: vi.fn()
}))
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn()
}))

describe('ImportantInfoCard', () => {
  const complianceReportId = '123'
  const alertRef = { current: { triggerAlert: vi.fn() } }
  const navigate = vi.fn()
  const createSupplementalReportMock = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()

    // Mock useNavigate
    useNavigate.mockReturnValue(navigate)

    // Mock useTranslation
    useTranslation.mockReturnValue({
      t: (key) => key
    })

    // Mock useCreateSupplementalReport
    useCreateSupplementalReport.mockReturnValue({
      mutate: createSupplementalReportMock,
      isLoading: false
    })
  })

  it('renders the component with expected text', () => {
    render(
      <ImportantInfoCard
        complianceReportId={complianceReportId}
        alertRef={alertRef}
      />,
      { wrapper }
    )

    expect(screen.getByText('report:impInfoTitle')).toBeInTheDocument()
    expect(screen.getByText('report:impInfo')).toBeInTheDocument()
    expect(
      screen.getByText('report:createSupplementalRptBtn')
    ).toBeInTheDocument()
  })

  it('calls createSupplementalReport when button is clicked', () => {
    render(
      <ImportantInfoCard
        complianceReportId={complianceReportId}
        alertRef={alertRef}
      />,
      { wrapper }
    )

    const button = screen.getByText('report:createSupplementalRptBtn')
    fireEvent.click(button)

    expect(createSupplementalReportMock).toHaveBeenCalled()
  })

  it('navigates to new report on success', async () => {
    const newReportData = {
      data: {
        complianceReportId: '456',
        compliancePeriod: {
          description: '2024'
        }
      }
    }

    // Mock the mutate function to call onSuccess immediately
    createSupplementalReportMock.mockImplementation(() => {
      const options = useCreateSupplementalReport.mock.calls[0][1]
      options.onSuccess(newReportData)
    })

    render(
      <ImportantInfoCard
        complianceReportId={complianceReportId}
        alertRef={alertRef}
      />,
      { wrapper }
    )

    const button = screen.getByText('report:createSupplementalRptBtn')
    fireEvent.click(button)

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/compliance-reporting/2024/456', {
        state: {
          message: 'report:supplementalCreated',
          severity: 'success'
        }
      })
    })
  })

  it('displays error alert on error', async () => {
    const error = { message: 'Error message' }

    // Mock the mutate function to call onError immediately
    createSupplementalReportMock.mockImplementation(() => {
      const options = useCreateSupplementalReport.mock.calls[0][1]
      options.onError(error)
    })

    render(
      <ImportantInfoCard
        complianceReportId={complianceReportId}
        alertRef={alertRef}
      />,
      { wrapper }
    )

    const button = screen.getByText('report:createSupplementalRptBtn')
    fireEvent.click(button)

    await waitFor(() => {
      expect(alertRef.current.triggerAlert).toHaveBeenCalledWith({
        message: 'Error message',
        severity: 'error'
      })
    })
  })

  it('disables the button when isLoading is true', () => {
    // Mock isLoading to be true
    useCreateSupplementalReport.mockReturnValue({
      mutate: createSupplementalReportMock,
      isLoading: true
    })

    render(
      <ImportantInfoCard
        complianceReportId={complianceReportId}
        alertRef={alertRef}
      />,
      { wrapper }
    )

    const button = screen.getByText('report:createSupplementalRptBtn')
    expect(button).toBeDisabled()
  })
})
