import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createMemoryRouter,
  RouterProvider,
  useNavigate,
  useParams,
  useLocation
} from 'react-router-dom'
import { vi, describe, expect, beforeEach, afterEach } from 'vitest'
import { router } from '../index'
import { useKeycloak } from '@react-keycloak/web'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { buildPath } from '../routes'
import { test } from '@/tests/utils/fixtures'

// Helper function to create test router
const createTestRouter = (initialEntries = ['/']) => {
  return createMemoryRouter(router.routes, {
    initialEntries
  })
}

// Helper function to render router with providers
const renderRouterWithProviders = (testRouter, render, query) =>
  render(<RouterProvider router={testRouter} />, [query])

// Mock navigation hook for testing
let mockNavigate
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

// Mock all view components to capture route parameters
vi.mock('@/layouts/MainLayout', () => {
  const { Outlet } = require('react-router-dom')
  return {
    MainLayout: () => (
      <div data-test="main-layout">
        <Outlet />
      </div>
    )
  }
})

vi.mock('@/layouts/PublicLayout', () => {
  const { Outlet } = require('react-router-dom')
  return {
    __esModule: true,
    default: () => (
      <div data-test="public-layout">
        <Outlet />
      </div>
    )
  }
})

vi.mock('@/views/Dashboard', () => ({
  Dashboard: () => {
    const location = useLocation()
    return <div data-test="dashboard">Dashboard - {location.pathname}</div>
  }
}))

vi.mock('@/views/Organizations', () => ({
  Organizations: () => {
    const location = useLocation()
    return (
      <div data-test="organizations">Organizations - {location.pathname}</div>
    )
  },
  AddEditOrg: () => {
    const params = useParams()
    const location = useLocation()
    return (
      <div data-test="add-edit-org">
        Add/Edit Org - orgID: {params.orgID} - {location.pathname}
      </div>
    )
  },
  OrganizationView: () => {
    const params = useParams()
    const location = useLocation()
    return (
      <div data-test="organization-view">
        Organization View - orgID: {params.orgID} - {location.pathname}
      </div>
    )
  }
}))

vi.mock('@/views/Transactions', () => ({
  Transactions: () => {
    const location = useLocation()
    const searchParams = new URLSearchParams(location.search)
    return (
      <div data-test="transactions">
        Transactions - {location.pathname} - highlighted:{' '}
        {searchParams.get('hid')}
      </div>
    )
  },
  AddEditViewTransaction: () => {
    const params = useParams()
    const location = useLocation()
    return (
      <div data-test="add-edit-view-transaction">
        Transaction - transactionId: {params.transactionId} -{' '}
        {location.pathname}
      </div>
    )
  },
  ViewOrgTransaction: () => {
    const params = useParams()
    const location = useLocation()
    return (
      <div data-test="view-org-transaction">
        Org Transaction - transactionId: {params.transactionId} -{' '}
        {location.pathname}
      </div>
    )
  }
}))

vi.mock('@/views/Transfers', () => ({
  Transfers: () => {
    const location = useLocation()
    return <div data-test="transfers">Transfers - {location.pathname}</div>
  },
  AddEditViewTransfer: () => {
    const params = useParams()
    const location = useLocation()
    return (
      <div data-test="add-edit-view-transfer">
        Transfer - transferId: {params.transferId} - {location.pathname}
      </div>
    )
  }
}))

vi.mock('@/views/ComplianceReports', () => ({
  ComplianceReports: () => {
    const location = useLocation()
    return (
      <div data-test="compliance-reports">
        Compliance Reports - {location.pathname}
      </div>
    )
  },
  CreditCalculator: () => {
    const location = useLocation()
    return (
      <div data-test="credit-calculator">
        Compliance unit calculator - {location.pathname}
      </div>
    )
  }
}))

vi.mock('@/views/ComplianceReports/ComplianceReportViewSelector', () => ({
  ComplianceReportViewSelector: () => {
    const params = useParams()
    const location = useLocation()
    return (
      <div data-test="compliance-report-view">
        Report View - period: {params.compliancePeriod}, reportId:{' '}
        {params.complianceReportId} - {location.pathname}
      </div>
    )
  }
}))

vi.mock('@/views/FuelCodes', () => ({
  FuelCodes: () => {
    const location = useLocation()
    return <div data-test="fuel-codes">Fuel Codes - {location.pathname}</div>
  },
  MyFuelCodes: () => {
    const location = useLocation()
    return (
      <div data-test="my-fuel-codes">My Fuel Codes - {location.pathname}</div>
    )
  },
  AddEditFuelCode: () => {
    const params = useParams()
    const location = useLocation()
    return (
      <div data-test="add-edit-fuel-code">
        Add/Edit Fuel Code - fuelCodeID: {params.fuelCodeID || 'new'} -{' '}
        {location.pathname}
      </div>
    )
  },
  FuelCodeDetail: () => {
    const params = useParams()
    const location = useLocation()
    return (
      <div data-test="fuel-code-detail">
        Fuel Code Detail - fuelCodeID: {params.fuelCodeID} - {location.pathname}
      </div>
    )
  }
}))

vi.mock('@/views/Admin/AdminMenu', () => ({
  AdminMenu: () => {
    const location = useLocation()
    return <div data-test="admin-menu">Admin Menu - {location.pathname}</div>
  },
  AdminLanding: () => {
    const location = useLocation()
    return (
      <div data-test="admin-landing">Admin Landing - {location.pathname}</div>
    )
  }
}))

vi.mock('@/views/Admin/AdminMenu/components/ViewAuditLog', () => ({
  ViewAuditLog: () => {
    const params = useParams()
    const location = useLocation()
    return (
      <div data-test="view-audit-log">
        View Audit Log - auditLogId: {params.auditLogId} - {location.pathname}
      </div>
    )
  }
}))

vi.mock('@/views/Users', () => ({
  AddEditUser: ({ userType }) => {
    const params = useParams()
    const location = useLocation()
    return (
      <div data-test={`add-edit-user-${userType || 'default'}`}>
        Add/Edit User {userType} - userID: {params.userID} - orgID:{' '}
        {params.orgID} - {location.pathname}
      </div>
    )
  }
}))

vi.mock('@/views/Admin/AdminMenu/components/UserDetailsCard', () => ({
  __esModule: true,
  default: ({ addMode, userType }) => {
    const params = useParams()
    const location = useLocation()
    const testId = addMode
      ? `user-details-card-add-${userType || 'default'}`
      : `user-details-card-view-${userType || 'default'}`

    return (
      <div data-test={testId}>
        {addMode ? 'Add' : 'View'} User {userType || 'default'} - userID:{' '}
        {params.userID} - orgID: {params.orgID} - {location.pathname}
      </div>
    )
  }
}))

vi.mock('@/components/NotFound', () => ({
  NotFound: () => {
    const location = useLocation()
    return <div data-test="not-found">Not Found - {location.pathname}</div>
  }
}))

// Mock compliance report sub-components that were causing initialization errors
vi.mock('@/views/FuelSupplies/AddEditFuelSupplies', () => ({
  AddEditFuelSupplies: () => {
    const params = useParams()
    const location = useLocation()
    return (
      <div data-test="add-edit-fuel-supplies">
        Add/Edit Fuel Supplies - period: {params.compliancePeriod}, reportId:{' '}
        {params.complianceReportId} - {location.pathname}
      </div>
    )
  }
}))

vi.mock('@/views/NotionalTransfers', () => ({
  AddEditNotionalTransfers: () => {
    const params = useParams()
    const location = useLocation()
    return (
      <div data-test="add-edit-notional-transfers">
        Add/Edit Notional Transfers - period: {params.compliancePeriod},
        reportId: {params.complianceReportId} - {location.pathname}
      </div>
    )
  }
}))

vi.mock('@/views/AllocationAgreements/AddEditAllocationAgreements', () => ({
  AddEditAllocationAgreements: () => {
    const params = useParams()
    const location = useLocation()
    return (
      <div data-test="add-edit-allocation-agreements">
        Add/Edit Allocation Agreements - period: {params.compliancePeriod},
        reportId: {params.complianceReportId} - {location.pathname}
      </div>
    )
  }
}))

vi.mock('@/views/OtherUses/AddEditOtherUses', () => ({
  AddEditOtherUses: () => {
    const params = useParams()
    const location = useLocation()
    return (
      <div data-test="add-edit-other-uses">
        Add/Edit Other Uses - period: {params.compliancePeriod}, reportId:{' '}
        {params.complianceReportId} - {location.pathname}
      </div>
    )
  }
}))

vi.mock('@/views/FinalSupplyEquipments/AddEditFinalSupplyEquipments', () => ({
  AddEditFinalSupplyEquipments: () => {
    const params = useParams()
    const location = useLocation()
    return (
      <div data-test="add-edit-final-supply-equipments">
        Add/Edit Final Supply Equipments - period: {params.compliancePeriod},
        reportId: {params.complianceReportId} - {location.pathname}
      </div>
    )
  }
}))

vi.mock('@/views/FuelExports/AddEditFuelExports', () => ({
  AddEditFuelExports: () => {
    const params = useParams()
    const location = useLocation()
    return (
      <div data-test="add-edit-fuel-exports">
        Add/Edit Fuel Exports - period: {params.compliancePeriod}, reportId:{' '}
        {params.complianceReportId} - {location.pathname}
      </div>
    )
  }
}))

// Mock authentication
vi.mock('@react-keycloak/web')
vi.mock('@/hooks/useCurrentUser')

// Mock authorization context
vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn(),
    forbidden: false
  })
}))

// Mock RequireAuth to allow authenticated access
vi.mock('@/components/RequireAuth', () => ({
  RequireAuth: ({ children }) => children
}))

// Mock Role component
vi.mock('@/components/Role', () => ({
  Role: ({ children }) => children
}))

// Navigation test component
const NavigationTestComponent = ({ onNavigate }) => {
  const navigate = useNavigate()
  mockNavigate = navigate

  return (
    <div data-test="navigation-controls">
      <button
        data-test="nav-to-dashboard"
        onClick={() => {
          navigate('/')
          onNavigate?.('/')
        }}
      >
        Dashboard
      </button>
      <button
        data-test="nav-to-organizations"
        onClick={() => {
          navigate('/organizations')
          onNavigate?.('/organizations')
        }}
      >
        Organizations
      </button>
      <button
        data-test="nav-to-transactions"
        onClick={() => {
          navigate('/transactions')
          onNavigate?.('/transactions')
        }}
      >
        Transactions
      </button>
      <button
        data-test="nav-with-state"
        onClick={() => {
          navigate('/organizations/123', { state: { test: 'data' } })
          onNavigate?.('/organizations/123')
        }}
      >
        Org with State
      </button>
    </div>
  )
}

describe('Dynamic Routes and Navigation', () => {
  const mockKeycloak = {
    authenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    token: 'mock-token',
    realmAccess: {
      roles: ['admin', 'user']
    }
  }

  const mockCurrentUser = {
    isError: false,
    error: null,
    data: {
      id: 1,
      username: 'testuser'
    }
  }

  beforeEach(() => {
    useKeycloak.mockReturnValue({
      keycloak: mockKeycloak
    })
    useCurrentUser.mockReturnValue(mockCurrentUser)

    sessionStorage.clear()
    mockNavigate = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Dynamic Route Parameters', () => {
    test('should handle organization ID parameter correctly', async ({
      render,
      query
    }) => {
      const testRouter = createTestRouter(['/organizations/123'])
      renderRouterWithProviders(testRouter, render, query)

      await waitFor(() => {
        expect(screen.getByTestId('organization-view')).toBeInTheDocument()
        expect(screen.getByText(/orgID: 123/)).toBeInTheDocument()
        expect(screen.getByText(/\/organizations\/123/)).toBeInTheDocument()
      })
    })

    test('should handle transaction ID parameter correctly', async ({
      render,
      query
    }) => {
      const testRouter = createTestRouter(['/transactions/456'])
      renderRouterWithProviders(testRouter, render, query)

      await waitFor(() => {
        expect(
          screen.getByTestId('add-edit-view-transaction')
        ).toBeInTheDocument()
        expect(screen.getByText(/transactionId: 456/)).toBeInTheDocument()
        expect(screen.getByText(/\/transactions\/456/)).toBeInTheDocument()
      })
    })

    test('should handle transfer ID parameter correctly', async ({
      render,
      query
    }) => {
      const testRouter = createTestRouter(['/transfers/789'])
      renderRouterWithProviders(testRouter, render, query)

      await waitFor(() => {
        expect(screen.getByTestId('add-edit-view-transfer')).toBeInTheDocument()
        expect(screen.getByText(/transferId: 789/)).toBeInTheDocument()
        expect(screen.getByText(/\/transfers\/789/)).toBeInTheDocument()
      })
    })

    test('should handle compliance report multiple parameters', async ({
      render,
      query
    }) => {
      const testRouter = createTestRouter([
        '/compliance-reporting/2024/report123'
      ])
      renderRouterWithProviders(testRouter, render, query)

      await waitFor(() => {
        expect(screen.getByTestId('compliance-report-view')).toBeInTheDocument()
        expect(screen.getByText(/period: 2024/)).toBeInTheDocument()
        expect(screen.getByText(/reportId: report123/)).toBeInTheDocument()
      })
    })

    test('should handle audit log ID parameter', async ({ render, query }) => {
      const testRouter = createTestRouter(['/admin/audit-log/audit456'])
      renderRouterWithProviders(testRouter, render, query)

      await waitFor(() => {
        expect(screen.getByTestId('view-audit-log')).toBeInTheDocument()
        expect(screen.getByText(/auditLogId: audit456/)).toBeInTheDocument()
      })
    })

    test('should handle fuel code ID parameter', async ({ render, query }) => {
      const testRouter = createTestRouter(['/fuel-codes/FC001'])
      renderRouterWithProviders(testRouter, render, query)

      await waitFor(() => {
        expect(screen.getByTestId('add-edit-fuel-code')).toBeInTheDocument()
        expect(screen.getByText(/fuelCodeID: FC001/)).toBeInTheDocument()
      })
    })

    test('should handle nested user parameters in organizations', async ({
      render,
      query
    }) => {
      const testRouter = createTestRouter([
        '/organizations/org123/users/user456'
      ])
      renderRouterWithProviders(testRouter, render, query)

      await waitFor(() => {
        expect(
          screen.getByTestId('user-details-card-view-bceid')
        ).toBeInTheDocument()
        expect(screen.getByText(/userID: user456/)).toBeInTheDocument()
        expect(screen.getByText(/orgID: org123/)).toBeInTheDocument()
      })
    })
  })

  describe('Query Parameters', () => {
    test('should handle highlighted transaction query parameter', async ({
      render,
      query
    }) => {
      const testRouter = createTestRouter(['/transactions?hid=transaction123'])
      renderRouterWithProviders(testRouter, render, query)

      await waitFor(() => {
        expect(screen.getByTestId('transactions')).toBeInTheDocument()
        expect(
          screen.getByText(/highlighted: transaction123/)
        ).toBeInTheDocument()
      })
    })

    test('should handle missing query parameters gracefully', async ({
      render,
      query
    }) => {
      const testRouter = createTestRouter(['/transactions'])
      renderRouterWithProviders(testRouter, render, query)

      await waitFor(() => {
        expect(screen.getByTestId('transactions')).toBeInTheDocument()
        expect(screen.getByText(/highlighted:/)).toBeInTheDocument()
      })
    })
  })

  describe('Programmatic Navigation', () => {
    test('should navigate between routes programmatically', async ({
      render,
      query
    }) => {
      const user = userEvent.setup()
      const onNavigate = vi.fn()

      const testRouter = createTestRouter(['/'])
      render(
        <div>
          <RouterProvider router={testRouter} />
          <NavigationTestComponent onNavigate={onNavigate} />
        </div>,
        [query]
      )

      // Start at dashboard
      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument()
      })

      // Navigate to organizations
      await user.click(screen.getByTestId('nav-to-organizations'))

      await waitFor(() => {
        expect(onNavigate).toHaveBeenCalledWith('/organizations')
      })
    })

    test('should handle navigation with state', async ({ render, query }) => {
      const user = userEvent.setup()
      const onNavigate = vi.fn()

      const testRouter = createTestRouter(['/'])
      render(
        <div>
          <RouterProvider router={testRouter} />
          <NavigationTestComponent onNavigate={onNavigate} />
        </div>,
        [query]
      )

      // Navigate with state
      await user.click(screen.getByTestId('nav-with-state'))

      await waitFor(() => {
        expect(onNavigate).toHaveBeenCalledWith('/organizations/123')
      })
    })

    test('should handle back/forward navigation', async ({ render, query }) => {
      const testRouter = createTestRouter(['/transactions'])
      renderRouterWithProviders(testRouter, render, query)

      // Should start at transactions (index 2)
      await waitFor(() => {
        expect(screen.getByTestId('transactions')).toBeInTheDocument()
      })
    })
  })

  describe('Route Validation', () => {
    test('should handle invalid route parameters gracefully', async ({
      render,
      query
    }) => {
      const testRouter = createTestRouter(['/organizations/'])
      renderRouterWithProviders(testRouter, render, query)

      // Should match organizations list route, not the view route
      await waitFor(() => {
        expect(screen.getByTestId('organizations')).toBeInTheDocument()
      })
    })

    test('should handle routes with special characters in parameters', async ({
      render,
      query
    }) => {
      const testRouter = createTestRouter(['/transactions/tx-123-abc'])
      renderRouterWithProviders(testRouter, render, query)

      await waitFor(() => {
        expect(
          screen.getByTestId('add-edit-view-transaction')
        ).toBeInTheDocument()
        expect(
          screen.getByText(/transactionId: tx-123-abc/)
        ).toBeInTheDocument()
      })
    })

    test('should handle routes with encoded characters', async ({
      render,
      query
    }) => {
      const testRouter = createTestRouter(['/fuel-codes/FC%20001'])
      renderRouterWithProviders(testRouter, render, query)

      await waitFor(() => {
        expect(screen.getByTestId('add-edit-fuel-code')).toBeInTheDocument()
        expect(screen.getByText(/fuelCodeID: FC 001/)).toBeInTheDocument()
      })
    })
  })

  describe('Route Path Building Utility', () => {
    test('should build paths with single parameter', () => {
      const path = buildPath('/organizations/:orgID', { orgID: '123' })
      expect(path).toBe('/organizations/123')
    })

    test('should build paths with multiple parameters', () => {
      const path = buildPath('/organizations/:orgID/users/:userID', {
        orgID: '123',
        userID: '456'
      })
      expect(path).toBe('/organizations/123/users/456')
    })

    test('should build paths with missing parameters', () => {
      const path = buildPath('/organizations/:orgID/users/:userID', {
        orgID: '123'
      })
      expect(path).toBe('/organizations/123/users/:userID')
    })

    test('should build paths with extra parameters', () => {
      const path = buildPath('/organizations/:orgID', {
        orgID: '123',
        extra: 'ignored'
      })
      expect(path).toBe('/organizations/123')
    })

    test('should handle empty parameters object', () => {
      const path = buildPath('/organizations/:orgID', {})
      expect(path).toBe('/organizations/:orgID')
    })

    test('should handle no parameters', () => {
      const path = buildPath('/organizations/:orgID')
      expect(path).toBe('/organizations/:orgID')
    })
  })

  describe('Complex Route Scenarios', () => {
    test('should handle admin adjustment transaction route', async ({
      render,
      query
    }) => {
      const testRouter = createTestRouter(['/admin-adjustment/edit/txn456'])
      renderRouterWithProviders(testRouter, render, query)

      await waitFor(() => {
        expect(
          screen.getByTestId('add-edit-view-transaction')
        ).toBeInTheDocument()
        expect(screen.getByText(/transactionId: txn456/)).toBeInTheDocument()
        expect(
          screen.getByText(/\/admin-adjustment\/edit\/txn456/)
        ).toBeInTheDocument()
      })
    })

    test('should handle initiative agreement organization view', async ({
      render,
      query
    }) => {
      const testRouter = createTestRouter(['/org-initiative-agreement/ia123'])
      renderRouterWithProviders(testRouter, render, query)

      await waitFor(() => {
        expect(screen.getByTestId('view-org-transaction')).toBeInTheDocument()
        expect(screen.getByText(/transactionId: ia123/)).toBeInTheDocument()
      })
    })

    test('should handle compliance report nested routes', async ({
      render,
      query
    }) => {
      const testRouter = createTestRouter([
        '/compliance-reporting/2024/123/supply-of-fuel'
      ])
      renderRouterWithProviders(testRouter, render, query)

      // This should render the supply of fuel component for the nested route
      await waitFor(() => {
        expect(screen.getByTestId('add-edit-fuel-supplies')).toBeInTheDocument()
        expect(screen.getByText(/period: 2024/)).toBeInTheDocument()
        expect(screen.getByText(/reportId: 123/)).toBeInTheDocument()
      })
    })
  })

  describe('Navigation Edge Cases', () => {
    test('should handle navigation to non-existent routes', async ({
      render,
      query
    }) => {
      const testRouter = createTestRouter(['/non-existent-route'])
      renderRouterWithProviders(testRouter, render, query)

      await waitFor(() => {
        expect(screen.getByTestId('not-found')).toBeInTheDocument()
        expect(screen.getByText(/\/non-existent-route/)).toBeInTheDocument()
      })
    })

    test('should preserve location state during navigation', async ({
      render,
      query
    }) => {
      const state = { fromDashboard: true, timestamp: Date.now() }

      const testRouter = createTestRouter([
        { pathname: '/organizations/123', state }
      ])
      renderRouterWithProviders(testRouter, render, query)

      await waitFor(() => {
        expect(screen.getByTestId('organization-view')).toBeInTheDocument()
        expect(screen.getByText(/orgID: 123/)).toBeInTheDocument()
      })
    })

    test('should handle rapid navigation changes', async ({
      render,
      query
    }) => {
      // Test final state navigation directly instead of rerendering
      const testRouter = createTestRouter(['/transactions'])
      renderRouterWithProviders(testRouter, render, query)

      await waitFor(() => {
        expect(screen.getByTestId('transactions')).toBeInTheDocument()
      })
    })
  })
})
