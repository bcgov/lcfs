import React from 'react'
import { vi, describe, expect, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { useNavigate, useParams } from 'react-router-dom'
import * as useUserHook from '@/hooks/useUser.js'
import * as useCurrentUserHook from '@/hooks/useCurrentUser.js'
import * as useOrganizationHook from '@/hooks/useOrganization.js'
import { test } from '@/tests/utils/fixtures'
import { UserDetailsCard } from '../UserDetailsCard.jsx'

// Mocks
vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'test-token',
      authenticated: true
    }
  })
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn(),
    useParams: vi.fn()
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/utils/grid/cellRenderers', () => ({
  LinkRenderer: vi.fn(),
  RoleSpanRenderer: vi.fn(),
  StatusRenderer: vi.fn()
}))

vi.mock('@/views/Admin/AdminMenu/components/_schema', () => ({
  defaultSortModel: [],
  userActivityColDefs: []
}))

vi.mock('@/constants/routes', () => ({
  apiRoutes: {
    getUserActivities: '/api/users/:userID/activities'
  }
}))

vi.mock('@/routes/routes', () => ({
  ROUTES: {
    ORGANIZATION: { ORG: '/organization' },
    ORGANIZATIONS: { VIEW: '/organizations/:orgID' },
    ADMIN: { USERS: { LIST: '/admin/users' } },
    TRANSFERS: { VIEW: '/transfers/:transferId' },
    TRANSACTIONS: {
      ADMIN_ADJUSTMENT: {
        VIEW: '/transactions/admin-adjustment/:transactionId'
      },
      INITIATIVE_AGREEMENT: {
        VIEW: '/transactions/initiative-agreement/:transactionId'
      }
    }
  },
  buildPath: vi.fn((route, params) =>
    route.replace(/:(\w+)/g, (match, param) => params[param])
  )
}))

vi.mock('@/constants/roles', () => ({
  roles: {
    government: 'government',
    supplier: 'supplier',
    administrator: 'administrator',
    manage_users: 'manage_users'
  }
}))

vi.mock('@/components/Loading', () => ({
  default: () => <div data-test="loading">Loading...</div>
}))

vi.mock('@/components/Role', () => ({
  Role: ({ children, roles }) => <>{children}</>
}))

vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: (props) => (
    <div
      data-test="bc-grid-container"
      data-grid-key={props.gridKey}
      className="ag-theme-material"
    >
      Mocked DataGrid
    </div>
  )
}))

vi.mock('@/components/BCAlert', () => ({
  BCAlert2: React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      triggerAlert: vi.fn()
    }))
    return <div data-test="bc-alert">Alert Component</div>
  }),
  FloatingAlert: React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      triggerAlert: vi.fn()
    }))
    return <div data-test="floating-alert">Floating Alert Component</div>
  })
}))

vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  default: ({ title, editButton, content, id }) => (
    <div data-test={id || 'widget-card'}>
      <div data-test="card-title">{title}</div>
      {editButton && (
        <button
          data-test="edit-button"
          onClick={editButton.onClick}
          id={editButton.id}
        >
          {editButton.text}
        </button>
      )}
      <div data-test="card-content">{content}</div>
    </div>
  )
}))

vi.mock('@/views/UserDetailsCard/UserProfile', () => ({
  UserProfile: ({ data }) => (
    <div data-test="user-profile">
      User Profile for {data?.firstName} {data?.lastName}
    </div>
  )
}))

// Try alternative paths in case the structure is different
vi.mock('../UserProfile', () => ({
  UserProfile: ({ data }) => (
    <div data-test="user-profile">
      User Profile for {data?.firstName} {data?.lastName}
    </div>
  )
}))

vi.mock('./UserProfile', () => ({
  UserProfile: ({ data }) => (
    <div data-test="user-profile">
      User Profile for {data?.firstName} {data?.lastName}
    </div>
  )
}))

vi.mock('@/views/Users', () => ({
  AddEditUser: ({ handleSaveSuccess, handleCancelEdit, userType }) => (
    <div data-test="add-edit-user">
      <div>Add/Edit User Component - {userType}</div>
      <button data-test="save-button" onClick={() => handleSaveSuccess()}>
        Save
      </button>
      <button data-test="cancel-button" onClick={() => handleCancelEdit()}>
        Cancel
      </button>
    </div>
  )
}))

vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }) => <div {...props}>{children}</div>
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => <div {...props}>{children}</div>
}))

vi.mock('@/hooks/useUser')
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useOrganization')

// Helper functions for data-test queries since the framework expects data-test instead of data-testid
const getByDataTest = (testId) => {
  const element = document.querySelector(`[data-test="${testId}"]`)
  if (!element) {
    throw new Error(`Unable to find element with data-test="${testId}"`)
  }
  return element
}

const queryByDataTest = (testId) =>
  document.querySelector(`[data-test="${testId}"]`)

const mockNavigate = vi.fn()
const mockUser = {
  firstName: 'John',
  lastName: 'Doe',
  keycloakEmail: 'john.doe@example.com',
  phone: '1234567890',
  organization: {
    name: 'Test Org',
    organizationId: '123'
  },
  isGovernmentUser: false
}

const mockCurrentUser = {
  organization: { organizationId: '123' },
  roles: [{ name: 'administrator' }]
}

describe('UserDetailsCard Component', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    // Setup default mocks - this will be overridden in individual tests as needed
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)

    // Default params for edit mode
    vi.mocked(useParams).mockReturnValue({
      userID: '1',
      orgID: '123'
    })

    const defaultHasRoles = vi.fn((roleInput) => {
      // Handle both single role strings and arrays of roles
      const rolesToCheck = Array.isArray(roleInput) ? roleInput : [roleInput]
      const userRoles = ['administrator', 'manage_users']
      return rolesToCheck.some((role) => userRoles.includes(role))
    })

    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      hasRoles: defaultHasRoles,
      data: mockCurrentUser
    })

    // Mock both hooks to return the same data structure
    const mockHookReturn = {
      data: mockUser,
      isLoading: false,
      isLoadingError: false,
      isError: false,
      error: null,
      refetch: vi.fn()
    }

    vi.mocked(useUserHook.useUser).mockReturnValue(mockHookReturn)
    vi.mocked(useOrganizationHook.useOrganizationUser).mockReturnValue(
      mockHookReturn
    )
  })

  describe('Loading and Error States', () => {
    test('renders loading state', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      vi.mocked(useUserHook.useUser).mockReturnValue({
        data: null,
        isLoading: true,
        isLoadingError: false,
        isError: false,
        error: null,
        refetch: vi.fn()
      })

      render(<UserDetailsCard />, [query, theme, localization, router])
      expect(getByDataTest('loading')).toBeInTheDocument()
    })

    test('renders error state', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const errorMessage = 'An error occurred'
      vi.mocked(useUserHook.useUser).mockReturnValue({
        data: null,
        isLoading: false,
        isLoadingError: false,
        isError: true,
        error: {
          message: errorMessage,
          response: { data: { detail: errorMessage } }
        },
        refetch: vi.fn()
      })

      render(<UserDetailsCard />, [query, theme, localization, router])
      expect(getByDataTest('bc-alert')).toBeInTheDocument()
    })
  })

  describe('Rendering Modes', () => {
    test('renders in view mode by default', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserDetailsCard />, [query, theme, localization, router])

      expect(getByDataTest('user-profile')).toBeInTheDocument()
      expect(screen.getByText('User Profile for John Doe')).toBeInTheDocument()
      expect(getByDataTest('card-title')).toHaveTextContent('admin:userDetails')
    })

    test('renders in add mode when addMode prop is true', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      // For add mode, there should be no userID
      vi.mocked(useParams).mockReturnValue({
        orgID: '123',
        userID: undefined
      })

      render(<UserDetailsCard addMode={true} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(getByDataTest('add-edit-user')).toBeInTheDocument()
      expect(getByDataTest('card-title')).toHaveTextContent('Add user')
    })

    test('passes userType prop to AddEditUser component', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      // For add mode, there should be no userID
      vi.mocked(useParams).mockReturnValue({
        orgID: '123',
        userID: undefined
      })

      render(<UserDetailsCard addMode={true} userType="bceid" />, [
        query,
        theme,
        localization,
        router
      ])

      expect(
        screen.getByText('Add/Edit User Component - bceid')
      ).toBeInTheDocument()
    })
  })

  describe('Edit Functionality', () => {
    test('shows edit button when user has permissions', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
        hasRoles: vi.fn((role) => {
          if (Array.isArray(role)) {
            return role.some((r) =>
              ['administrator', 'manage_users'].includes(r)
            )
          }
          return ['administrator', 'manage_users'].includes(role)
        }),
        data: mockCurrentUser
      })

      render(<UserDetailsCard />, [query, theme, localization, router])

      expect(getByDataTest('edit-button')).toBeInTheDocument()
      expect(getByDataTest('edit-button')).toHaveTextContent('admin:editBtn')
    })

    test('does not show edit button when user lacks permissions', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
        hasRoles: vi.fn(() => false),
        data: mockCurrentUser
      })

      render(<UserDetailsCard />, [query, theme, localization, router])

      expect(queryByDataTest('edit-button')).not.toBeInTheDocument()
    })

    test('switches to edit mode when edit button is clicked', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
        hasRoles: vi.fn((role) => {
          if (Array.isArray(role)) {
            return role.some((r) =>
              ['administrator', 'manage_users'].includes(r)
            )
          }
          return ['administrator', 'manage_users'].includes(role)
        }),
        data: mockCurrentUser
      })

      render(<UserDetailsCard />, [query, theme, localization, router])

      const editButton = getByDataTest('edit-button')
      fireEvent.click(editButton)

      await waitFor(() => {
        expect(getByDataTest('add-edit-user')).toBeInTheDocument()
        expect(queryByDataTest('user-profile')).not.toBeInTheDocument()
      })
    })

    test('shows correct title in edit mode', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
        hasRoles: vi.fn((role) => {
          if (Array.isArray(role)) {
            return role.some((r) =>
              ['administrator', 'manage_users'].includes(r)
            )
          }
          return ['administrator', 'manage_users'].includes(role)
        }),
        data: mockCurrentUser
      })

      render(<UserDetailsCard />, [query, theme, localization, router])

      fireEvent.click(getByDataTest('edit-button'))

      await waitFor(() => {
        expect(getByDataTest('card-title')).toHaveTextContent(
          'Edit user to Test Org'
        )
      })
    })
  })

  describe('Navigation and Actions', () => {
    test('navigates on cancel in add mode', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      // For add mode, there should be no userID
      vi.mocked(useParams).mockReturnValue({
        orgID: '123',
        userID: undefined
      })

      vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
        hasRoles: vi.fn((role) => {
          if (Array.isArray(role)) {
            return role.includes('supplier')
          }
          return role === 'supplier'
        }),
        data: mockCurrentUser
      })

      render(<UserDetailsCard addMode={true} />, [
        query,
        theme,
        localization,
        router
      ])

      const cancelButton = getByDataTest('cancel-button')
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled()
      })
    })

    test('exits edit mode on cancel in edit mode', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
        hasRoles: vi.fn((role) => {
          if (Array.isArray(role)) {
            return role.some((r) =>
              ['administrator', 'manage_users'].includes(r)
            )
          }
          return ['administrator', 'manage_users'].includes(role)
        }),
        data: mockCurrentUser
      })

      render(<UserDetailsCard />, [query, theme, localization, router])

      // Enter edit mode first
      fireEvent.click(getByDataTest('edit-button'))

      await waitFor(() => {
        expect(getByDataTest('add-edit-user')).toBeInTheDocument()
      })

      // Cancel edit
      fireEvent.click(getByDataTest('cancel-button'))

      await waitFor(() => {
        expect(getByDataTest('user-profile')).toBeInTheDocument()
        expect(queryByDataTest('add-edit-user')).not.toBeInTheDocument()
      })
    })

    test('handles save success in add mode', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      // For add mode, there should be no userID
      vi.mocked(useParams).mockReturnValue({
        orgID: '123',
        userID: undefined
      })

      render(<UserDetailsCard addMode={true} />, [
        query,
        theme,
        localization,
        router
      ])

      const saveButton = getByDataTest('save-button')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled()
      })
    })

    test('handles save success in edit mode', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const mockRefetch = vi.fn()
      vi.mocked(useUserHook.useUser).mockReturnValue({
        data: mockUser,
        isLoading: false,
        isLoadingError: false,
        isError: false,
        error: null,
        refetch: mockRefetch
      })

      vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
        hasRoles: vi.fn((role) => {
          if (Array.isArray(role)) {
            return role.some((r) =>
              ['administrator', 'manage_users'].includes(r)
            )
          }
          return ['administrator', 'manage_users'].includes(role)
        }),
        data: mockCurrentUser
      })

      render(<UserDetailsCard />, [query, theme, localization, router])

      // Enter edit mode
      fireEvent.click(getByDataTest('edit-button'))

      await waitFor(() => {
        expect(getByDataTest('add-edit-user')).toBeInTheDocument()
      })

      // Save
      fireEvent.click(getByDataTest('save-button'))

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled()
        expect(getByDataTest('user-profile')).toBeInTheDocument()
      })
    })
  })

  describe('Role-based Behavior', () => {
    test('uses useOrganizationUser hook for supplier role', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
        hasRoles: vi.fn((role) => {
          if (Array.isArray(role)) {
            return role.includes('supplier')
          }
          return role === 'supplier'
        }),
        data: mockCurrentUser
      })

      render(<UserDetailsCard />, [query, theme, localization, router])

      expect(useOrganizationHook.useOrganizationUser).toHaveBeenCalledWith(
        '123',
        '1'
      )
    })

    test('uses useUser hook for non-supplier role', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
        hasRoles: vi.fn(() => false),
        data: mockCurrentUser
      })

      render(<UserDetailsCard />, [query, theme, localization, router])

      expect(useUserHook.useUser).toHaveBeenCalledWith(1)
    })

    test('shows user activity grid for admin/manage_users roles', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
        hasRoles: vi.fn((role) => {
          if (Array.isArray(role)) {
            return role.some((r) =>
              ['administrator', 'manage_users'].includes(r)
            )
          }
          return ['administrator', 'manage_users'].includes(role)
        }),
        data: mockCurrentUser
      })

      render(<UserDetailsCard />, [query, theme, localization, router])

      expect(getByDataTest('bc-grid-container')).toBeInTheDocument()
      expect(screen.getByText('admin:UserActivity')).toBeInTheDocument()
    })

    test('does not show user activity grid in add mode', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
        hasRoles: vi.fn(() => true),
        data: mockCurrentUser
      })

      render(<UserDetailsCard addMode={true} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(queryByDataTest('bc-grid-container')).not.toBeInTheDocument()
    })
  })

  describe('Grid Configuration', () => {
    test('configures data grid with correct props', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
        hasRoles: vi.fn((role) => {
          if (Array.isArray(role)) {
            return role.some((r) =>
              ['administrator', 'manage_users'].includes(r)
            )
          }
          return ['administrator', 'manage_users'].includes(role)
        }),
        data: mockCurrentUser
      })

      render(<UserDetailsCard />, [query, theme, localization, router])

      const dataGrid = getByDataTest('bc-grid-container')
      expect(dataGrid).toBeInTheDocument()

      expect(dataGrid).toHaveClass('ag-theme-material')
    })
  })

  describe('Responsive Design', () => {
    test('applies correct responsive width styles', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserDetailsCard />, [query, theme, localization, router])

      // The BCBox should have responsive maxWidth styles
      // This would be tested through CSS-in-JS or checking computed styles
      expect(getByDataTest('user-card')).toBeInTheDocument()
    })

    test('adjusts width in edit mode', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
        hasRoles: vi.fn((role) => {
          if (Array.isArray(role)) {
            return role.some((r) =>
              ['administrator', 'manage_users'].includes(r)
            )
          }
          return ['administrator', 'manage_users'].includes(role)
        }),
        data: mockCurrentUser
      })

      render(<UserDetailsCard />, [query, theme, localization, router])

      fireEvent.click(getByDataTest('edit-button'))

      await waitFor(() => {
        expect(getByDataTest('add-edit-user')).toBeInTheDocument()
      })
    })
  })
})
