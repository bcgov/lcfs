import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ScheduleASummary } from '@/views/ComplianceReports/legacy-deprecated/ScheduleASummary'
import { wrapper } from '@/tests/utils/wrapper.jsx'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn(),
    useParams: () => ({
      complianceReportId: '123'
    }),
    useLocation: vi.fn()
  }
})

// Mock the BCGridViewer correctly
vi.mock('@/components/BCDataGrid/BCGridViewer', () => {
  const { forwardRef } = require('react')
  return {
    BCGridViewer: forwardRef((props, ref) => <div data-testid="mockedBCGridViewer" ref={ref}></div>)
  }
})

// Mock useGetNotionalTransfers hook
vi.mock('@/hooks/useNotionalTransfer', () => ({
  useGetNotionalTransfers: () => ({
    data: {
      pagination: { page: 1, size: 10, total: 2 },
      notionalTransfers: [
        {
          notionalTransferId: '001',
          legalName: 'Partner 1',
          addressForService: 'Address 1'
        },
        {
          notionalTransferId: '002',
          legalName: 'Partner 2',
          addressForService: 'Address 2'
        }
      ]
    }
  })
}))

describe('NotionalTransferSummary Component Tests', () => {
  let navigate
  let location

  beforeEach(() => {
    navigate = vi.fn()
    location = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigate)
    vi.mocked(useLocation).mockReturnValue(location)
  })

  afterEach(() => {
    cleanup()
    vi.resetAllMocks()
  })

  it('displays alert message if location state has a message', () => {
    const mockLocation = {
      state: { message: 'Test Alert Message', severity: 'error' }
    }
    vi.mocked(useLocation).mockReturnValue(mockLocation)

    render(<ScheduleASummary status="DRAFT" />, { wrapper })
    const alertBox = screen.getByTestId('alert-box')
    expect(alertBox).toBeInTheDocument()
    expect(alertBox.textContent).toContain('Test Alert Message')
  })
})
