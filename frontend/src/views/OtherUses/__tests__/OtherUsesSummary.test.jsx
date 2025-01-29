import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import {
  BrowserRouter as Router,
  useNavigate,
  useParams,
  useLocation
} from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { OtherUsesSummary } from '../OtherUsesSummary'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn(),
    useParams: () => ({
      complianceReportId: '123',
      compliancePeriod: '2024'
    }),
    useLocation: vi.fn()
  }
})

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'mock-token',
      authenticated: true,
      initialized: true
    }
  })
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: {
      roles: [{ name: 'Supplier' }, { name: 'Government' }]
    }
  })
}))

vi.mock('@/components/BCDataGrid/BCDataGridServer', () => ({
  __esModule: true,
  default: () => <div data-test="mockedBCDataGridServer"></div>
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    setForbidden: vi.fn()
  })
}))

const WrapperComponent = (props) => {
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <Router>
          <OtherUsesSummary {...props} />
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('OtherUsesSummary Component Tests', () => {
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

  it('renders root component', () => {
    render(<WrapperComponent compliancePeriod="2024" />)
    const title = screen.getByTestId('container')
    expect(title).toBeInTheDocument()
  })

  it('displays alert message on initial load if present', () => {
    const mockLocation = {
      state: { message: 'Test Alert Message', severity: 'error' }
    }
    vi.mocked(useLocation).mockReturnValue(mockLocation)

    render(<WrapperComponent compliancePeriod="2024" />)
    const alertBox = screen.getByTestId('alert-box')
    expect(alertBox).toBeInTheDocument()
    expect(alertBox.textContent).toContain('Test Alert Message')
  })
})
