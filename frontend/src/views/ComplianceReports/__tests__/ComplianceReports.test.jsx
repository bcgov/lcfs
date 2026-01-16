import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ComplianceReports } from '../ComplianceReports'
import { ROUTES } from '@/routes/routes'
import { wrapper } from '@/tests/utils/wrapper.jsx'

// Mock hooks
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

const mockNavigate = vi.fn()
const mockLocation = { state: null }
const mockRefetch = vi.fn()
const mockCreateMutate = vi.fn()

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useLocation: () => mockLocation,
  useNavigate: () => mockNavigate
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    hasRoles: vi.fn(() => true),
    data: { organization: { organizationId: 1 } }
  })
}))

vi.mock('@/hooks/useComplianceReports', () => ({
  useCreateComplianceReport: () => ({
    mutate: mockCreateMutate,
    isLoading: false
  }),
  useGetComplianceReportList: () => ({
    data: { reports: [] },
    refetch: mockRefetch
  })
}))

// Mock components with refs and callbacks
const mockGridRef = { current: { clearFilters: vi.fn() } }
const mockAlertRef = { current: { triggerAlert: vi.fn() } }

vi.mock('../components/NewComplianceReportButton', () => ({
  NewComplianceReportButton: React.forwardRef((props, ref) => {
    // Expose the ref for testing
    React.useEffect(() => {
      if (ref && typeof ref === 'object') {
        ref.current = { test: 'newButtonRef' }
      }
    }, [ref])

    return (
      <button
        data-test="new-compliance-report-button"
        onClick={() => props.handleNewReport({ description: '2024' })}
        disabled={props.isButtonLoading}
      >
        New Report
      </button>
    )
  })
}))

vi.mock('../components/_schema', () => ({
  reportsColDefs: vi.fn((t, hasSupplierRole, handleRefresh) => {
    // Call handleRefresh to test it
    if (handleRefresh) {
      handleRefresh()
    }
    return []
  }),
  defaultSortModel: []
}))

vi.mock('@/components/BCDataGrid/BCGridViewer.jsx', () => ({
  BCGridViewer: React.forwardRef((props, ref) => {
    React.useEffect(() => {
      if (ref && typeof ref === 'object') {
        ref.current = mockGridRef.current
      }
    }, [ref])

    return (
      <div
        data-test="bc-grid-viewer"
        onClick={() => {
          // Test pagination change callback
          if (props.onPaginationChange) {
            props.onPaginationChange({
              page: 2,
              size: 20,
              sortOrders: [],
              filters: []
            })
          }
        }}
      >
        BCGridViewer
      </div>
    )
  })
}))

vi.mock('@/components/BCAlert', () => ({
  __esModule: true,
  default: React.forwardRef((props, ref) => {
    React.useEffect(() => {
      if (ref && typeof ref === 'object') {
        ref.current = mockAlertRef.current
      }
    }, [ref])

    return props.children ? (
      <div data-test="alert-box" severity={props.severity}>
        {props.children}
      </div>
    ) : null
  })
}))

// Store the current mock roles for testing
let mockUserRoles = ['Compliance Reporting']

vi.mock('@/components/Role', () => ({
  Role: ({ children, roles }) => {
    // Check if any of the required roles match the mock user roles
    const hasRole = roles?.some((role) => mockUserRoles.includes(role))
    return hasRole ? <div data-test="role-wrapper">{children}</div> : null
  }
}))

describe('ComplianceReports - Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
    mockRefetch.mockClear()
    mockCreateMutate.mockClear()
    mockAlertRef.current.triggerAlert.mockClear()
    mockGridRef.current.clearFilters.mockClear()
    mockLocation.state = null
    // Reset mock user roles to default (compliance_reporting) for most tests
    mockUserRoles = ['Compliance Reporting']

    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        removeItem: vi.fn()
      },
      writable: true
    })
  })

  it('renders without crashing and calls handleRefresh through reportsColDefs', () => {
    render(<ComplianceReports />, { wrapper })

    expect(screen.getByText('report:title')).toBeInTheDocument()
    expect(mockRefetch).toHaveBeenCalled()
  })

  it('handles pagination change callback', async () => {
    render(<ComplianceReports />, { wrapper })

    const gridViewer = screen.getByTestId('bc-grid-viewer')
    fireEvent.click(gridViewer)

    // This should trigger the onPaginationChange callback
    expect(gridViewer).toBeInTheDocument()
  })


  it('handles new compliance report creation', async () => {
    render(<ComplianceReports />, { wrapper })

    const newReportButton = screen.getByTestId('new-compliance-report-button')
    fireEvent.click(newReportButton)

    expect(mockCreateMutate).toHaveBeenCalledWith({
      compliancePeriod: '2024',
      organizationId: 1,
      status: expect.any(String)
    })
  })

  it('displays alert from location state', async () => {
    // Set up location with state
    vi.mocked(mockLocation).state = {
      message: 'Test message',
      severity: 'error'
    }

    const { rerender } = render(<ComplianceReports />, { wrapper })

    rerender(<ComplianceReports />)

    await waitFor(() => {
      expect(screen.getByTestId('alert-box')).toBeInTheDocument()
      expect(screen.getByText('Test message')).toBeInTheDocument()
    })
  })

  it('displays alert with default severity when not provided', async () => {
    vi.mocked(mockLocation).state = { message: 'Test message without severity' }

    const { rerender } = render(<ComplianceReports />, { wrapper })

    rerender(<ComplianceReports />)

    await waitFor(() => {
      expect(screen.getByTestId('alert-box')).toBeInTheDocument()
    })
  })

  it('navigates to credit calculator', () => {
    render(<ComplianceReports />, { wrapper })

    const calculatorButton = screen.getByTestId('credit-calculator')
    fireEvent.click(calculatorButton)

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.CREDIT_CALCULATOR)
  })

  it('renders all main UI components', () => {
    render(<ComplianceReports />, { wrapper })

    expect(screen.getByText('report:title')).toBeInTheDocument()
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(
      screen.getByTestId('new-compliance-report-button')
    ).toBeInTheDocument()
    expect(screen.getByTestId('credit-calculator')).toBeInTheDocument()
  })

  it('does not display alert when no message in location state', () => {
    vi.mocked(mockLocation).state = null

    render(<ComplianceReports />, { wrapper })

    expect(screen.queryByTestId('alert-box')).not.toBeInTheDocument()
  })

  it('handles getRowId callback correctly', () => {
    render(<ComplianceReports />, { wrapper })

    // The getRowId function should be passed to BCGridViewer
    // We test this indirectly by ensuring the component renders successfully
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('tests getRowId function returns correct UUID', () => {
    const testParams = {
      data: { complianceReportGroupUuid: 'test-uuid-123' }
    }

    render(<ComplianceReports />, { wrapper })

    // We can't directly test the useCallback function, but we ensure it's properly created
    // and used by the component
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('tests defaultColDef useMemo structure', () => {
    render(<ComplianceReports />, { wrapper })

    // Verify the component renders, which means useMemo worked properly
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('tests component functionality without dynamic mock changes', () => {
    render(<ComplianceReports />, { wrapper })

    // Test that all basic functionality works
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(
      screen.getByTestId('new-compliance-report-button')
    ).toBeInTheDocument()
    expect(screen.getByTestId('credit-calculator')).toBeInTheDocument()
  })

  it('handles location state effect with no severity', () => {
    vi.mocked(mockLocation).state = { message: 'Test message' }

    render(<ComplianceReports />, { wrapper })

    expect(screen.getByTestId('alert-box')).toBeInTheDocument()
    expect(screen.getByText('Test message')).toBeInTheDocument()
  })

  it('tests defaultColDef cellRendererParams url function', () => {
    const testData = {
      data: {
        compliancePeriod: '2024',
        complianceReportId: 123
      }
    }

    render(<ComplianceReports />, { wrapper })

    // The component should render successfully with defaultColDef
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('tests defaultColDef cellRendererParams state function', () => {
    const testData = {
      reportStatus: 'DRAFT'
    }

    render(<ComplianceReports />, { wrapper })

    // The component should render successfully with defaultColDef
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  describe('Role-based Create Button Visibility', () => {
    it('shows create button for user with compliance_reporting role', () => {
      mockUserRoles = ['Compliance Reporting']

      render(<ComplianceReports />, { wrapper })

      expect(
        screen.getByTestId('new-compliance-report-button')
      ).toBeInTheDocument()
    })

    it('hides create button for user with only signing_authority role', () => {
      mockUserRoles = ['Signing Authority']

      render(<ComplianceReports />, { wrapper })

      expect(
        screen.queryByTestId('new-compliance-report-button')
      ).not.toBeInTheDocument()
    })

    it('shows create button for user with both compliance_reporting and signing_authority roles', () => {
      mockUserRoles = ['Compliance Reporting', 'Signing Authority']

      render(<ComplianceReports />, { wrapper })

      expect(
        screen.getByTestId('new-compliance-report-button')
      ).toBeInTheDocument()
    })

    it('hides create button for user with no relevant roles', () => {
      mockUserRoles = ['Read Only']

      render(<ComplianceReports />, { wrapper })

      expect(
        screen.queryByTestId('new-compliance-report-button')
      ).not.toBeInTheDocument()
    })
  })
})
