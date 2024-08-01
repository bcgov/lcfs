import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter as Router } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes' // Make sure this path is correct
import { AdminMenu } from '../AdminMenu'

// Mock the useNavigate hook
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock the Users component
vi.mock('../AdminMenu/components/Users', () => ({
  Users: () => <div data-test="mock-users">Mocked Users Component</div>,
}))

// Mock the translation function
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

// Custom render function with all necessary providers
const customRender = (ui, options = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const AllTheProviders = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <Router>
          {children}
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: AllTheProviders, ...options })
}

describe('AdminMenu Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
  })

  it('renders correctly with initial tab', () => {
    customRender(<AdminMenu tabIndex={0} />)
    expect(screen.getByText('Users')).toBeInTheDocument()
    expect(screen.getByText('UserActivity')).toBeInTheDocument()
    expect(screen.getByText('ComplianceReporting')).toBeInTheDocument()
    expect(screen.getByTestId('mock-users')).toBeInTheDocument()
  })

  it('changes tab when clicked', () => {
    customRender(<AdminMenu tabIndex={0} />)
    fireEvent.click(screen.getByText('UserActivity'))
    expect(mockNavigate).toHaveBeenCalledWith('/admin/user-activity')
  })

  it('displays correct content for each tab', () => {
    const { rerender } = customRender(<AdminMenu tabIndex={0} />)
    expect(screen.getByTestId('mock-users')).toBeInTheDocument()

    rerender(<AdminMenu tabIndex={1} />)
    expect(screen.getByText('User activity')).toBeInTheDocument()

    rerender(<AdminMenu tabIndex={3} />)
    expect(screen.getByText('Compliance reporting')).toBeInTheDocument()
  })
})