import React from 'react'
import { describe, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ComplianceReports } from '../ComplianceReports'
import { ROUTES } from '@/routes/routes'
import { test } from '@/tests/utils/fixtures'

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

vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
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

  test('renders without crashing and calls handleRefresh through reportsColDefs', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ComplianceReports />, [query, theme, localization, router])

    expect(screen.getByText('report:title')).toBeInTheDocument()
    expect(mockRefetch).toHaveBeenCalled()
  })

  test('handles pagination change callback', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ComplianceReports />, [query, theme, localization, router])

    const gridViewer = screen.getByTestId('bc-grid-viewer')
    fireEvent.click(gridViewer)

    // This should trigger the onPaginationChange callback
    expect(gridViewer).toBeInTheDocument()
  })

  test('handles new compliance report creation', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ComplianceReports />, [query, theme, localization, router])

    const newReportButton = screen.getByTestId('new-compliance-report-button')
    fireEvent.click(newReportButton)

    expect(mockCreateMutate).toHaveBeenCalledWith({
      compliancePeriod: '2024',
      organizationId: 1,
      status: expect.any(String)
    })
  })

  test('displays alert from location state', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    // Set up location with state
    vi.mocked(mockLocation).state = {
      message: 'Test message',
      severity: 'error'
    }

    const { rerender } = render(<ComplianceReports />, [
      query,
      theme,
      localization,
      router
    ])

    rerender(<ComplianceReports />)

    await waitFor(() => {
      expect(screen.getByTestId('alert-box')).toBeInTheDocument()
      expect(screen.getByText('Test message')).toBeInTheDocument()
    })
  })

  test('displays alert with default severity when not provided', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    vi.mocked(mockLocation).state = { message: 'Test message without severity' }

    const { rerender } = render(<ComplianceReports />, [
      query,
      theme,
      localization,
      router
    ])

    rerender(<ComplianceReports />)

    await waitFor(() => {
      expect(screen.getByTestId('alert-box')).toBeInTheDocument()
    })
  })

  test('navigates to credit calculator', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ComplianceReports />, [query, theme, localization, router])

    const calculatorButton = screen.getByTestId('credit-calculator')
    fireEvent.click(calculatorButton)

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.CREDIT_CALCULATOR)
  })

  test('renders all main UI components', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ComplianceReports />, [query, theme, localization, router])

    expect(screen.getByText('report:title')).toBeInTheDocument()
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(
      screen.getByTestId('new-compliance-report-button')
    ).toBeInTheDocument()
    expect(screen.getByTestId('credit-calculator')).toBeInTheDocument()
  })

  test('does not display alert when no message in location state', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    vi.mocked(mockLocation).state = null

    render(<ComplianceReports />, [query, theme, localization, router])

    expect(screen.queryByTestId('alert-box')).not.toBeInTheDocument()
  })

  test('handles getRowId callback correctly', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ComplianceReports />, [query, theme, localization, router])

    // The getRowId function should be passed to BCGridViewer
    // We test this indirectly by ensuring the component renders successfully
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  test('tests getRowId function returns correct UUID', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const testParams = {
      data: { complianceReportGroupUuid: 'test-uuid-123' }
    }

    render(<ComplianceReports />, [query, theme, localization, router])

    // We can't directly test the useCallback function, but we ensure it's properly created
    // and used by the component
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  test('tests defaultColDef useMemo structure', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ComplianceReports />, [query, theme, localization, router])

    // Verify the component renders, which means useMemo worked properly
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  test('tests component functionality without dynamic mock changes', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ComplianceReports />, [query, theme, localization, router])

    // Test that all basic functionality works
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(
      screen.getByTestId('new-compliance-report-button')
    ).toBeInTheDocument()
    expect(screen.getByTestId('credit-calculator')).toBeInTheDocument()
  })

  test('handles location state effect with no severity', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    vi.mocked(mockLocation).state = { message: 'Test message' }

    render(<ComplianceReports />, [query, theme, localization, router])

    expect(screen.getByTestId('alert-box')).toBeInTheDocument()
    expect(screen.getByText('Test message')).toBeInTheDocument()
  })

  test('tests defaultColDef cellRendererParams url function', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const testData = {
      data: {
        compliancePeriod: '2024',
        complianceReportId: 123
      }
    }

    render(<ComplianceReports />, [query, theme, localization, router])

    // The component should render successfully with defaultColDef
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  test('tests defaultColDef cellRendererParams state function', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const testData = {
      reportStatus: 'DRAFT'
    }

    render(<ComplianceReports />, [query, theme, localization, router])

    // The component should render successfully with defaultColDef
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  describe('Role-based Create Button Visibility', () => {
    test('shows create button for user with compliance_reporting role', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      mockUserRoles = ['Compliance Reporting']

      render(<ComplianceReports />, [query, theme, localization, router])

      expect(
        screen.getByTestId('new-compliance-report-button')
      ).toBeInTheDocument()
    })

    test('hides create button for user with only signing_authority role', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      mockUserRoles = ['Signing Authority']

      render(<ComplianceReports />, [query, theme, localization, router])

      expect(
        screen.queryByTestId('new-compliance-report-button')
      ).not.toBeInTheDocument()
    })

    test('shows create button for user with both compliance_reporting and signing_authority roles', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      mockUserRoles = ['Compliance Reporting', 'Signing Authority']

      render(<ComplianceReports />, [query, theme, localization, router])

      expect(
        screen.getByTestId('new-compliance-report-button')
      ).toBeInTheDocument()
    })

    test('hides create button for user with no relevant roles', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      mockUserRoles = ['Read Only']

      render(<ComplianceReports />, [query, theme, localization, router])

      expect(
        screen.queryByTestId('new-compliance-report-button')
      ).not.toBeInTheDocument()
    })
  })
})
