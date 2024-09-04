import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { BrowserRouter as Router, useNavigate, useParams, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { NotionalTransferSummary } from '@/views/NotionalTransfers'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn(),
    useParams: () => ({
      complianceReportId: '123',
    }),
    useLocation: vi.fn()
  }
})

// Mock the BCGridViewer correctly
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: () => <div data-testid="mockedBCGridViewer"></div>,
}))

// Mock useGetNotionalTransfers hook
vi.mock('@/hooks/useNotionalTransfer', () => ({
  useGetNotionalTransfers: () => ({
    data: {
      pagination: { page: 1, size: 10, total: 2 },
      notionalTransfers: [
        { notionalTransferId: '001', legalName: 'Partner 1', addressForService: 'Address 1' },
        { notionalTransferId: '002', legalName: 'Partner 2', addressForService: 'Address 2' }
      ]
    }
  })
}))

const WrapperComponent = (props) => {
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <Router>
          <NotionalTransferSummary {...props} />
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

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

    render(<WrapperComponent data={[]} />)
    const alertBox = screen.getByTestId('alert-box')
    expect(alertBox).toBeInTheDocument()
    expect(alertBox.textContent).toContain('Test Alert Message')
  })
})
