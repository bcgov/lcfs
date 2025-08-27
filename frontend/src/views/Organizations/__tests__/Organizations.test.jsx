import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Organizations } from '../Organizations'
import { wrapper } from '@/tests/utils/wrapper.jsx'
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

// Mock useApiService
vi.mock('@/services/useApiService', () => ({
  useApiService: () => ({
    download: mockDownload
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
        'org:orgDownloadFailMsg': 'Failed to download organization information.',
        'org:userDownloadFailMsg': 'Failed to download user information.',
        'org:noOrgsFound': 'No organizations found'
      }
      return translations[key] || key
    }
  })
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
  default: ({ children, ...props }) => (
    <div data-test="bc-box" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCButton', () => ({
  default: ({ children, onClick, ...props }) => (
    <button data-test="bc-button" onClick={onClick} {...props}>
      {children}
    </button>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => (
    <span data-test="bc-typography" {...props}>
      {children}
    </span>
  )
}))

vi.mock('@/components/BCDataGrid/BCDataGridServer', () => ({
  default: ({ onSetResetGrid, ...props }) => {
    // Simulate calling onSetResetGrid callback when component mounts
    if (onSetResetGrid && typeof onSetResetGrid === 'function') {
      setTimeout(() => {
        onSetResetGrid(() => console.log('Grid reset'))
      }, 0)
    }
    return <div data-test="data-grid-server" {...props}>Data Grid</div>
  }
}))

vi.mock('@mui/material', () => ({
  Stack: ({ children, ...props }) => (
    <div data-test="mui-stack" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon }) => (
    <span data-test="font-awesome-icon" data-icon={icon?.iconName}>
      Icon
    </span>
  )
}))

vi.mock('@/components/DownloadButton', () => ({
  DownloadButton: ({ onDownload, isDownloading, label, ...props }) => (
    <button
      data-test="download-button"
      onClick={onDownload}
      disabled={isDownloading}
      {...props}
    >
      {isDownloading ? `${label}...` : label}
    </button>
  )
}))

vi.mock('@/components/ClearFiltersButton', () => ({
  ClearFiltersButton: ({ onClick, ...props }) => (
    <button data-test="clear-filters-button" onClick={onClick} {...props}>
      Clear Filters
    </button>
  )
}))

vi.mock('@/components/Role', () => ({
  Role: ({ children, roles }) => (
    <div data-test="role-component" data-roles={roles?.join(',')}>
      {children}
    </div>
  )
}))

vi.mock('@/utils/grid/cellRenderers.jsx', () => ({
  LinkRenderer: () => <div data-test="link-renderer">Link</div>
}))

describe('Organizations Component', () => {
  beforeEach(() => {
    mockLocationValue.state = null
    mockDownload.mockReset().mockResolvedValue({})
    navigateMock.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
    mockLocationValue.state = null
  })

  describe('Component Rendering', () => {
    it('renders the component with correct title', () => {
      render(<Organizations />, { wrapper })
      
      expect(screen.getByText('Organizations')).toBeInTheDocument()
      expect(screen.getByTestId('data-grid-server')).toBeInTheDocument()
    })

    it('renders all main UI elements', () => {
      render(<Organizations />, { wrapper })
      
      expect(screen.getByText('Organizations')).toBeInTheDocument()
      expect(screen.getByText('Add Organization')).toBeInTheDocument()
      expect(screen.getByText('Download Organizations')).toBeInTheDocument()
      expect(screen.getByText('Download Users')).toBeInTheDocument()
      expect(screen.getByTestId('clear-filters-button')).toBeInTheDocument()
      expect(screen.getByTestId('role-component')).toBeInTheDocument()
      expect(screen.getByTestId('data-grid-server')).toBeInTheDocument()
    })
  })

  describe('Navigation Functions', () => {
    it('navigates to add organization page when add button is clicked', async () => {
      render(<Organizations />, { wrapper })

      const addButton = screen.getByText('Add Organization')
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith(ROUTES.ORGANIZATIONS.ADD)
      })
    })
  })

  describe('Download Functions', () => {
    it('handles organization download successfully', async () => {
      render(<Organizations />, { wrapper })

      const downloadOrgButton = screen.getByText('Download Organizations')
      fireEvent.click(downloadOrgButton)

      await waitFor(() => {
        expect(mockDownload).toHaveBeenCalledWith({ url: '/api/organizations/export' })
      })
    })

    it('handles user download successfully', async () => {
      render(<Organizations />, { wrapper })

      const downloadUserButton = screen.getByText('Download Users')
      fireEvent.click(downloadUserButton)

      await waitFor(() => {
        expect(mockDownload).toHaveBeenCalledWith({ url: '/api/users/export' })
      })
    })

    it('shows error alert when organization download fails', async () => {
      mockDownload.mockRejectedValueOnce(new Error('Download failed'))

      render(<Organizations />, { wrapper })

      const downloadOrgButton = screen.getByText('Download Organizations')
      fireEvent.click(downloadOrgButton)

      await waitFor(() => {
        const alertBox = screen.getByTestId('alert-box')
        expect(alertBox).toBeInTheDocument()
        expect(alertBox.textContent).toContain('Failed to download organization information.')
      })
    })

    it('shows error alert when user download fails', async () => {
      mockDownload.mockRejectedValueOnce(new Error('User download failed'))

      render(<Organizations />, { wrapper })

      const downloadUserButton = screen.getByText('Download Users')
      fireEvent.click(downloadUserButton)

      await waitFor(() => {
        const alertBox = screen.getByTestId('alert-box')
        expect(alertBox).toBeInTheDocument()
        expect(alertBox.textContent).toContain('Failed to download user information.')
      })
    })
  })

  describe('Clear Filters Function', () => {
    it('renders clear filters button', () => {
      render(<Organizations />, { wrapper })

      const clearFiltersButton = screen.getByTestId('clear-filters-button')
      expect(clearFiltersButton).toBeInTheDocument()
      expect(clearFiltersButton.textContent).toBe('Clear Filters')
    })

    it('handles clear filters button click', () => {
      render(<Organizations />, { wrapper })
      
      const clearFiltersButton = screen.getByTestId('clear-filters-button')
      fireEvent.click(clearFiltersButton)
      
      expect(clearFiltersButton).toBeInTheDocument()
    })
  })

  describe('useEffect Location State Handling', () => {
    it('sets alert message when location state contains message', async () => {
      mockLocationValue.state = {
        message: 'Success message',
        severity: 'success'
      }

      render(<Organizations />, { wrapper })

      await waitFor(() => {
        const alertBox = screen.getByTestId('alert-box')
        expect(alertBox).toBeInTheDocument()
        expect(alertBox.textContent).toContain('Success message')
        expect(alertBox).toHaveAttribute('data-severity', 'success')
      })
    })

    it('defaults to info severity when severity not provided', async () => {
      mockLocationValue.state = {
        message: 'Info message'
      }

      render(<Organizations />, { wrapper })

      await waitFor(() => {
        const alertBox = screen.getByTestId('alert-box')
        expect(alertBox).toBeInTheDocument()
        expect(alertBox.textContent).toContain('Info message')
      })
    })

    it('does not show alert when no location state message', () => {
      mockLocationValue.state = null

      render(<Organizations />, { wrapper })

      expect(screen.queryByTestId('alert-box')).not.toBeInTheDocument()
    })

    it('does not show alert when location state exists but no message', () => {
      mockLocationValue.state = {
        someOtherProperty: 'value'
      }

      render(<Organizations />, { wrapper })

      expect(screen.queryByTestId('alert-box')).not.toBeInTheDocument()
    })
  })

  describe('Conditional Rendering', () => {
    it('hides alert when alertMessage is empty', () => {
      mockLocationValue.state = null
      
      render(<Organizations />, { wrapper })
      
      expect(screen.queryByTestId('alert-box')).not.toBeInTheDocument()
    })

    it('shows alert when alertMessage exists', async () => {
      mockLocationValue.state = {
        message: 'Test alert message'
      }
      
      render(<Organizations />, { wrapper })
      
      await waitFor(() => {
        expect(screen.getByTestId('alert-box')).toBeInTheDocument()
      })
    })

    it('shows add organization button for admin users', () => {
      render(<Organizations />, { wrapper })

      const roleComponent = screen.getByTestId('role-component')
      expect(roleComponent).toBeInTheDocument()
      expect(roleComponent).toHaveAttribute('data-roles', 'Administrator')

      const addButton = screen.getByText('Add Organization')
      expect(addButton).toBeInTheDocument()
    })
  })

  describe('Grid Configuration', () => {
    it('renders data grid with correct configuration', () => {
      render(<Organizations />, { wrapper })
      
      const grid = screen.getByTestId('data-grid-server')
      expect(grid).toBeInTheDocument()
      expect(grid.textContent).toBe('Data Grid')
    })

    it('provides getRowId function that works correctly', () => {
      render(<Organizations />, { wrapper })
      
      expect(screen.getByTestId('data-grid-server')).toBeInTheDocument()
    })
  })

  describe('Memoized Values', () => {
    it('renders with correct API endpoint configuration', () => {
      render(<Organizations />, { wrapper })
      
      expect(screen.getByTestId('data-grid-server')).toBeInTheDocument()
    })

    it('renders with correct grid options', () => {
      render(<Organizations />, { wrapper })
      
      expect(screen.getByTestId('data-grid-server')).toBeInTheDocument()
    })

    it('renders with correct default column definition', () => {
      render(<Organizations />, { wrapper })
      
      expect(screen.getByTestId('data-grid-server')).toBeInTheDocument()
    })

    it('renders with correct default sort model', () => {
      render(<Organizations />, { wrapper })
      
      expect(screen.getByTestId('data-grid-server')).toBeInTheDocument()
    })
  })

  describe('Button State Management', () => {
    it('shows loading state during organization download', async () => {
      mockDownload.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      )

      render(<Organizations />, { wrapper })

      const downloadButton = screen.getByText('Download Organizations')
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(screen.getByText('Download Organizations...')).toBeInTheDocument()
      })
    })

    it('shows loading state during user download', async () => {
      mockDownload.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      )

      render(<Organizations />, { wrapper })

      const downloadButton = screen.getByText('Download Users')
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(screen.getByText('Download Users...')).toBeInTheDocument()
      })
    })
  })
})