import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Users } from '../AdminMenu/components/Users'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/constants/routes', () => ({
  ROUTES: {
    ADMIN_USERS_ADD: '/admin/users/add',
    ADMIN_USERS: '/admin/users'
  },
  apiRoutes: {
    listUsers: '/api/users'
  }
}))

vi.mock('../AdminMenu/components/_schema', () => ({
  usersColumnDefs: vi.fn(() => []),
  idirUserDefaultFilter: []
}))

vi.mock('@/utils/formatters', () => ({
  calculateRowHeight: vi.fn(() => 50)
}))

// Mock BCDataGridServer component
vi.mock('@/components/BCDataGrid/BCDataGridServer', () => ({
  default: ({}) => <div data-test="mocked-data-grid">Mocked DataGrid</div>
}))

// Helper component to access current location
const LocationDisplay = () => {
  const location = useLocation()
  return <div data-test="location-display">{location.pathname}</div>
}

const WrapperComponent = ({ children, initialEntries = ['/'] }) => {
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  {children}
                  <LocationDisplay />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('Users Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(
      <WrapperComponent>
        <Users />
      </WrapperComponent>
    )
    expect(screen.getByText('admin:Users')).toBeInTheDocument()
  })

  it('displays the New User button', () => {
    render(
      <WrapperComponent>
        <Users />
      </WrapperComponent>
    )
    const newUserButton = screen.getByText('admin:newUserBtn')
    expect(newUserButton).toBeInTheDocument()
  })

  it('navigates to add user page when New User button is clicked', async () => {
    render(
      <WrapperComponent>
        <Users />
      </WrapperComponent>
    )
    const newUserButton = screen.getByText('admin:newUserBtn')
    fireEvent.click(newUserButton)

    // Check if the navigation occurred
    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/admin/users/add'
      )
    })
  })

  it('renders BCDataGridServer with correct props', () => {
    render(
      <WrapperComponent>
        <Users />
      </WrapperComponent>
    )
    expect(screen.getByTestId('mocked-data-grid')).toBeInTheDocument()
  })

  it('displays alert message when location state has a message', () => {
    const initialEntries = [
      {
        pathname: '/admin/users',
        state: { message: 'Test alert message', severity: 'success' }
      }
    ]
    render(
      <WrapperComponent initialEntries={initialEntries}>
        <Users />
      </WrapperComponent>
    )
    expect(screen.getByText('Test alert message')).toBeInTheDocument()
  })
})
