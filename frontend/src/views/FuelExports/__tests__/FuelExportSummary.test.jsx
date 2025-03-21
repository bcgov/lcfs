import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import {
  BrowserRouter as Router,
  useNavigate,
  useLocation
} from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { FuelExportSummary } from '../FuelExportSummary'

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

// Mock the BCGridViewer component
vi.mock('@/components/BCDataGrid/BCGridViewer2', () => ({
  BCGridViewer2: vi.fn(() => (
    <div data-test="mocked-bc-grid-viewer">Mocked BCGridViewer</div>
  ))
}))

// Mock useGetFuelExports hook
vi.mock('@/hooks/useFuelExport', () => ({
  useGetFuelExports: vi.fn(() => ({
    data: {
      pagination: { page: 1, size: 10, total: 2 },
      fuelExports: [
        {
          fuelExportId: '001',
          complianceUnits: 100,
          exportDate: '2024-09-10'
        },
        {
          fuelExportId: '002',
          complianceUnits: 200,
          exportDate: '2024-09-11'
        }
      ]
    }
  }))
}))

const WrapperComponent = (props) => {
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <Router>
          <FuelExportSummary {...props} />
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('FuelExportSummary Component Tests', () => {
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

  it('renders without crashing', () => {
    render(<WrapperComponent data={{ fuelExports: [] }} />)
    expect(screen.getByTestId('mocked-bc-grid-viewer')).toBeInTheDocument()
  })

  it('displays alert message if location state has a message', () => {
    const mockLocation = {
      state: { message: 'Test Alert Message', severity: 'error' }
    }
    vi.mocked(useLocation).mockReturnValue(mockLocation)

    render(<WrapperComponent data={{ fuelExports: [] }} />)
    const alertBox = screen.getByTestId('alert-box')
    expect(alertBox).toBeInTheDocument()
    expect(alertBox.textContent).toContain('Test Alert Message')
  })

  it('does not display alert message if location state has no message', () => {
    const mockLocation = { state: {} }
    vi.mocked(useLocation).mockReturnValue(mockLocation)

    render(<WrapperComponent data={{ fuelExports: [] }} />)
    const alertBox = screen.queryByTestId('alert-box')
    expect(alertBox).not.toBeInTheDocument()
  })
})
