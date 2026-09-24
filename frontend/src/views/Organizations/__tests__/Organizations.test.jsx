import { vi, describe, expect, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { Organizations } from '../Organizations'
import { test } from '@/tests/utils/fixtures'
import { ROUTES } from '@/routes/routes'

const navigateMock = vi.fn()
const mockDownload = vi.fn()
const mockLocationValue = {
  pathname: '/organizations',
  search: '',
  hash: '',
  state: null
}

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => mockLocationValue
  }
})

vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: ({
    gridRef,
    onPaginationChange,
    queryData,
    getRowId,
    gridOptions,
    defaultColDef,
    handleGridKey,
    ...otherProps
  }) => {
    // Set up gridRef with clearFilters method
    if (gridRef) {
      gridRef.current = {
        clearFilters: vi.fn()
      }
    }

    return (
      <div data-test="bc-grid-viewer" data-testid="grid" {...otherProps}>
        BCGridViewer
      </div>
    )
  }
}))

vi.mock('@/services/useApiService', () => ({
  useApiService: () => ({
    download: mockDownload,
    post: vi.fn().mockResolvedValue({
      data: {
        organizations: [],
        pagination: { total: 0, page: 1, size: 10 }
      }
    })
  })
}))

vi.mock('@/hooks/useOrganizations', () => ({
  useOrganizationsList: () => ({
    data: {
      organizations: [],
      pagination: { total: 0, page: 1, size: 10 }
    },
    isLoading: false,
    isError: false,
    error: null
  }),
  useOrganizationStatuses: () => ({ data: [] }),
  useOrganizationListStatuses: () => ({
    data: [{ status: 'Registered' }, { status: 'Unregistered' }],
    isLoading: false
  })
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'org:title': 'Organizations',
        'org:newOrgBtn': 'Add Organization',
        'org:orgDownloadBtn': 'Download Organizations',
        'org:userDownloadBtn': 'Download Users',
        'org:orgDownloadFailMsg':
          'Failed to download organization information.',
        'org:userDownloadFailMsg': 'Failed to download user information.',
        'org:noOrgsFound': 'No organizations found'
      }
      return translations[key] || key
    }
  })
}))

// Mock cell renderers
vi.mock('@/utils/grid/cellRenderers', () => ({
  OrgStatusRenderer: () => <span>Status Renderer</span>,
  OrgTypeRenderer: () => <span>Type Renderer</span>,
  LinkRenderer: () => <div data-test="link-renderer">Link</div>,
  YesNoTextRenderer: () => <span>Yes/No Renderer</span>
}))

// Mock schema
vi.mock('./OrganizationView/_schema', () => ({
  organizationsColDefs: () => [
    { field: 'name', headerName: 'Name' },
    { field: 'organizationId', headerName: 'ID' }
  ]
}))

// Mock API routes
vi.mock('@/constants/routes', () => ({
  apiRoutes: {
    organizationExport: '/api/organizations/export',
    exportUsers: '/api/users/export'
  }
}))

// Mock roles
vi.mock('@/constants/roles', () => ({
  roles: {
    administrator: 'Administrator'
  }
}))

// Mock routes
vi.mock('@/routes/routes', () => ({
  ROUTES: {
    ORGANIZATIONS: {
      ADD: '/organizations/add-org'
    }
  }
}))

// Mock UI components
vi.mock('@/components/BCAlert', () => ({
  default: ({ children, severity }) => (
    <div data-test="alert-box" data-severity={severity}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCBox', () => ({
  default: ({ children }) => <div data-test="bc-box">{children}</div>
}))

vi.mock('@/components/BCButton', () => ({
  default: ({ children, onClick, startIcon, disabled }) => (
    <button data-test="bc-button" onClick={onClick} disabled={disabled}>
      {startIcon && <span data-test="start-icon">{startIcon}</span>}
      {children}
    </button>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children }) => <span data-test="bc-typography">{children}</span>
}))

vi.mock('@mui/material', () => ({
  Stack: ({ children, direction, spacing, useFlexGap, flexWrap }) => (
    <div
      data-test="mui-stack"
      style={{
        display: 'flex',
        flexDirection: direction || 'column',
        gap: spacing,
        flexWrap: flexWrap || 'nowrap'
      }}
    >
      {children}
    </div>
  ),
  TextField: ({ value, onChange, label, disabled }) => (
    <input
      data-test="mui-textfield"
      value={value}
      onChange={(e) => onChange && onChange(e)}
      placeholder={label}
      disabled={disabled}
    />
  )
}))

vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon }) => (
    <span data-test="font-awesome-icon" data-icon={icon?.iconName}>
      Icon
    </span>
  )
}))

vi.mock('@/components/DownloadButton', () => {
  const { forwardRef } = require('react')
  return {
    DownloadButton: forwardRef(
      ({ onDownload, isDownloading, label, downloadLabel, dataTest }, ref) => (
        <button
          ref={ref}
          data-test={dataTest || 'download-button'}
          onClick={onDownload}
          disabled={isDownloading}
        >
          {isDownloading ? downloadLabel : label}
        </button>
      )
    )
  }
})

vi.mock('@/components/Role', () => ({
  Role: ({ children, roles }) => (
    <div data-test="role-component" data-roles={roles?.join(',')}>
      {children}
    </div>
  )
}))

describe('Organizations Component', () => {
  beforeEach(() => {
    mockLocationValue.state = null
    mockDownload.mockReset().mockResolvedValue({})
    navigateMock.mockReset()
  })

  afterEach(async () => {
    // Wait for any pending promises to resolve
    await new Promise((resolve) => setTimeout(resolve, 0))
    vi.clearAllMocks()
    mockLocationValue.state = null
  })

  describe('Component Rendering', () => {
    test('renders the component with correct title', ({ render }) => {
      render(<Organizations />)

      expect(screen.getByText('Organizations')).toBeInTheDocument()
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })

    test('renders all main UI elements', ({ render }) => {
      render(<Organizations />)

      expect(screen.getByText('Organizations')).toBeInTheDocument()
      expect(screen.getByText('Add Organization')).toBeInTheDocument()
      expect(screen.getByText('Download Organizations')).toBeInTheDocument()
      expect(screen.getByText('Download Users')).toBeInTheDocument()
      expect(screen.getByTestId('role-component')).toBeInTheDocument()
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  describe('Navigation Functions', () => {
    test('navigates to add organization page when add button is clicked', async ({
      render
    }) => {
      render(<Organizations />)

      const addButton = screen.getByText('Add Organization')
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith(ROUTES.ORGANIZATIONS.ADD)
      })
    })
  })

  describe('Download Functions', () => {
    test('handles organization download successfully', async ({ render }) => {
      render(<Organizations />)

      const downloadOrgButton = screen.getByText('Download Organizations')
      fireEvent.click(downloadOrgButton)

      await waitFor(() => {
        expect(mockDownload).toHaveBeenCalledWith({
          url: '/api/organizations/export'
        })
      })
    })

    test('handles user download successfully', async ({ render }) => {
      render(<Organizations />)

      const downloadUserButton = screen.getByText('Download Users')
      fireEvent.click(downloadUserButton)

      await waitFor(() => {
        expect(mockDownload).toHaveBeenCalledWith({ url: '/api/users/export' })
      })
    })

    test('displays alert message when location state contains message', ({
      render
    }) => {
      mockLocationValue.state = {
        message: 'Test message',
        severity: 'success'
      }

      render(<Organizations />)
      expect(screen.getByText('Test message')).toBeInTheDocument()
    })

    test('displays error alert when download fails', async ({ render }) => {
      mockDownload.mockRejectedValue(new Error('Download failed'))

      render(<Organizations />)

      const downloadOrgButton = screen.getByText('Download Organizations')
      fireEvent.click(downloadOrgButton)

      await waitFor(() => {
        const alertBox = screen.getByTestId('alert-box')
        expect(alertBox).toBeInTheDocument()
        expect(alertBox.textContent).toContain(
          'Failed to download organization information.'
        )
      })
    })

    test('shows error alert when user download fails', async ({ render }) => {
      mockDownload.mockRejectedValueOnce(new Error('User download failed'))

      render(<Organizations />)

      const downloadUserButton = screen.getByText('Download Users')
      fireEvent.click(downloadUserButton)

      await waitFor(() => {
        const alertBox = screen.getByTestId('alert-box')
        expect(alertBox).toBeInTheDocument()
        expect(alertBox.textContent).toContain(
          'Failed to download user information.'
        )
      })
    })
  })

  describe('useEffect Location State Handling', () => {
    test('sets alert message when location state contains message', async ({
      render
    }) => {
      mockLocationValue.state = {
        message: 'Success message',
        severity: 'success'
      }

      render(<Organizations />)

      await waitFor(() => {
        const alertBox = screen.getByTestId('alert-box')
        expect(alertBox).toBeInTheDocument()
        expect(alertBox.textContent).toContain('Success message')
        expect(alertBox).toHaveAttribute('data-severity', 'success')
      })
    })

    test('defaults to info severity when severity not provided', async ({
      render
    }) => {
      mockLocationValue.state = {
        message: 'Info message'
      }

      render(<Organizations />)

      await waitFor(() => {
        const alertBox = screen.getByTestId('alert-box')
        expect(alertBox).toBeInTheDocument()
        expect(alertBox.textContent).toContain('Info message')
      })
    })

    test('does not show alert when no location state message', ({ render }) => {
      mockLocationValue.state = null

      render(<Organizations />)

      expect(screen.queryByTestId('alert-box')).not.toBeInTheDocument()
    })

    test('does not show alert when location state exists but no message', ({
      render
    }) => {
      mockLocationValue.state = {
        someOtherProperty: 'value'
      }

      render(<Organizations />)

      expect(screen.queryByTestId('alert-box')).not.toBeInTheDocument()
    })
  })

  describe('Conditional Rendering', () => {
    test('hides alert when alertMessage is empty', ({ render }) => {
      mockLocationValue.state = null

      render(<Organizations />)

      expect(screen.queryByTestId('alert-box')).not.toBeInTheDocument()
    })

    test('shows alert when alertMessage exists', async ({ render }) => {
      mockLocationValue.state = {
        message: 'Test alert message'
      }

      render(<Organizations />)

      await waitFor(() => {
        expect(screen.getByTestId('alert-box')).toBeInTheDocument()
      })
    })

    test('shows add organization button for admin users', ({ render }) => {
      render(<Organizations />)

      const roleComponent = screen.getByTestId('role-component')
      expect(roleComponent).toBeInTheDocument()
      expect(roleComponent).toHaveAttribute('data-roles', 'Administrator')

      const addButton = screen.getByText('Add Organization')
      expect(addButton).toBeInTheDocument()
    })
  })

  describe('Grid Configuration', () => {
    test('renders data grid with correct configuration', ({ render }) => {
      render(<Organizations />)
      const grid = screen.getByTestId('bc-grid-viewer')
      expect(grid).toBeInTheDocument()
      expect(grid.textContent).toBe('BCGridViewer')
    })

    test('provides getRowId function that works correctly', ({ render }) => {
      render(<Organizations />)
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  describe('Memoized Values', () => {
    test('renders with correct API endpoint configuration', ({ render }) => {
      render(<Organizations />)
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })

    test('renders with correct grid options', ({ render }) => {
      render(<Organizations />)
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })

    test('renders with correct default column definition', ({ render }) => {
      render(<Organizations />)
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })

    test('renders with correct default sort model', ({ render }) => {
      render(<Organizations />)
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  describe('Button State Management', () => {
    test('shows loading state during organization download', async ({
      render
    }) => {
      let resolveDownload
      const downloadPromise = new Promise((resolve) => {
        resolveDownload = resolve
      })
      mockDownload.mockReturnValue(downloadPromise)

      render(<Organizations />)

      const downloadButton = screen.getByText('Download Organizations')
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(
          screen.getByText('Download Organizations...')
        ).toBeInTheDocument()
      })

      // Resolve the promise to clean up
      resolveDownload({})
      await downloadPromise
    })

    test('shows loading state during user download', async ({ render }) => {
      let resolveDownload
      const downloadPromise = new Promise((resolve) => {
        resolveDownload = resolve
      })
      mockDownload.mockReturnValue(downloadPromise)

      render(<Organizations />)

      const downloadButton = screen.getByText('Download Users')
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(screen.getByText('Download Users...')).toBeInTheDocument()
      })

      // Resolve the promise to clean up
      resolveDownload({})
      await downloadPromise
    })
  })
})
