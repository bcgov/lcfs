import * as useCurrentUserHook from '@/hooks/useCurrentUser'
import { getByDataTest } from '@/tests/utils/testHelpers'
import theme from '@/themes'
import { ThemeProvider } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Transactions } from '..'

vi.mock('@/hooks/useCurrentUser')

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
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

vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: ({ onRowClicked }) => (
    <div
      data-test="mocked-data-grid"
      onClick={() =>
        onRowClicked({
          data: { transactionId: '123', transactionType: 'Transfer' }
        })
      }
    >
      Mocked DataGrid
    </div>
  )
}))

vi.mock('@/services/useApiService', () => {
  const mockDownload = vi.fn(() => Promise.resolve())
  const mockPost = vi.fn(() =>
    Promise.resolve({
      data: {
        pagination: {
          total: 100,
          page: 1
        },
        transactions: [
          { transactionId: '001', name: 'Transaction 1' },
          { transactionId: '002', name: 'Transaction 2' }
        ]
      }
    })
  )

  return {
    useApiService: () => ({
      download: mockDownload,
      post: mockPost
    })
  }
})

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

describe('Transactions', () => {
  afterEach(() => {
    cleanup()
    vi.resetAllMocks()
  })
  beforeEach(() => {
    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      hasRoles: vi.fn(() => true),
      data: {
        organization: { organizationId: '123' },
        roles: [{ name: 'administrator' }]
      }
    })
  })
  it('renders correctly', async () => {
    render(
      <WrapperComponent>
        <Transactions />
      </WrapperComponent>
    )
    expect(screen.getByRole('heading', { name: 'Transactions' })).toBeInTheDocument()
  })

  it('displays alert message when location state has a message', () => {
    const initialEntries = [
      {
        pathname: '/transactions',
        state: { message: 'Test alert message', severity: 'success' }
      }
    ]
    render(
      <WrapperComponent initialEntries={initialEntries}>
        <Transactions />
      </WrapperComponent>
    )
    expect(screen.getByText('Test alert message')).toBeInTheDocument()
  })

  it('should render the "New Transaction" button for analyst roles and navigates to the correct page ', () => {
    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      hasRoles: vi.fn(() => true),
      data: {
        organization: { organizationId: '123' },
        roles: [{ name: 'Analyst' }]
      }
    })
    render(
      <WrapperComponent>
        <Transactions />
      </WrapperComponent>
    )

    const button = screen.getByRole('button', { name: /New Transaction/i })
    expect(button).toBeInTheDocument()

    fireEvent.click(button)
    expect(mockNavigate).toHaveBeenCalledWith('/transactions/add')
  })
  it('should render the "New Transaction" button for supplier users with transfer roles and navigates to the correct page', () => {
    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      hasRoles: vi.fn(() => true),
      data: {
        organization: {
          organizationId: '123',
          orgStatus: { status: 'Registered' }
        },
        roles: [{ name: 'Transfer' }]
      }
    })
    render(
      <WrapperComponent>
        <Transactions />
      </WrapperComponent>
    )

    const button = screen.getByRole('button', { name: /New Transfer/i })
    expect(button).toBeInTheDocument()

    fireEvent.click(button)
    expect(mockNavigate).toHaveBeenCalledWith('/transfers/add')
  })

  it('should render the download button', () => {
    render(
      <WrapperComponent>
        <Transactions />
      </WrapperComponent>
    )

    const button = screen.getByRole('button', { name: /Download as Excel/i })
    expect(button).toBeInTheDocument()
  })

  it('displays alert message on download failure', async () => {
    vi.mock('@/services/useApiService', () => ({
      useApiService: () => ({
        download: vi.fn(() => Promise.reject(new Error('Download failed')))
      })
    }))

    cleanup()

    render(
      <WrapperComponent>
        <Transactions />
      </WrapperComponent>
    )
    const downloadButton = getByDataTest('download-transactions-button')
    fireEvent.click(downloadButton)

    await waitFor(() => {
      const errorMessage = screen.getByText(
        /Failed to download transactions information./i
      )
      expect(errorMessage).toBeInTheDocument()
    })
  })
})
