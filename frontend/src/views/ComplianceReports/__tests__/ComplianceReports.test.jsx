import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes'
import { ComplianceReports } from '../ComplianceReports'
import * as useComplianceReportsHook from '@/hooks/useComplianceReports'
import * as useCurrentUserHook from '@/hooks/useCurrentUser'

// Custom render function with providers
const customRender = (ui, options = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  const AllTheProviders = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: AllTheProviders, ...options })
}

// Mock react-router-dom
const mockUseLocation = vi.fn()
const mockUseNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockUseNavigate
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useComplianceReports')

vi.mock('../components/NewComplianceReportButton', () => ({
  NewComplianceReportButton: ({ handleNewReport }) => (
    <button onClick={() => handleNewReport({ description: 'Test Period' })}>
      New Report
    </button>
  )
}))

vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: () => <div data-test="bc-data-grid">BCGridViewer</div>
}))

describe('ComplianceReports', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    // Set up default mock return values
    mockUseLocation.mockReturnValue({ state: {} })
    mockUseNavigate.mockReturnValue(vi.fn())

    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      hasRoles: vi.fn(() => true),
      data: {
        organization: { organizationId: '123' },
        roles: [{ name: 'Supplier' }]
      }
    })

    vi.mocked(
      useComplianceReportsHook.useCreateComplianceReport
    ).mockReturnValue({
      mutate: vi.fn(),
      isLoading: false,
      isError: false
    })

    vi.mocked(useComplianceReportsHook.useCompliancePeriod).mockReturnValue({
      mutate: vi.fn(),
      isLoading: false,
      isError: false
    })
  })

  it('renders the component', () => {
    customRender(<ComplianceReports />)
    expect(screen.getByText('report:title')).toBeInTheDocument()
  })

  it('renders the NewComplianceReportButton for suppliers', () => {
    customRender(<ComplianceReports />)
    expect(screen.getByText('New Report')).toBeInTheDocument()
  })

  it('renders the BCGridViewer', () => {
    customRender(<ComplianceReports />)
    expect(screen.getByTestId('bc-data-grid')).toBeInTheDocument()
  })

  it('handles creating a new report', async () => {
    const mockMutate = vi.fn()
    vi.mocked(
      useComplianceReportsHook.useCreateComplianceReport
    ).mockReturnValue({
      mutate: mockMutate,
      isLoading: false,
      isError: false
    })

    customRender(<ComplianceReports />)
    fireEvent.click(screen.getByText('New Report'))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({
        compliancePeriod: 'Test Period',
        organizationId: '123',
        status: 'Draft'
      })
    })
  })

  it('displays an alert message when location state has a message', () => {
    mockUseLocation.mockReturnValue({
      state: { message: 'Test alert', severity: 'success' }
    })

    customRender(<ComplianceReports />)
    expect(screen.getByText('Test alert')).toBeInTheDocument()
  })
})
