import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Organizations } from '../Organizations'
import { ROUTES } from '@/routes/routes'
import { wrapper } from '@/tests/utils/wrapper.jsx'
import { act } from 'react'

const navigateMock = vi.fn()
const mockDownload = vi.fn()

const mockLocationValue = {
    pathname: '/organizations',
    search: '',
    hash: '',
    state: null
  }

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
      ...actual,
      useNavigate: () => navigateMock,
      useLocation: () => mockLocationValue
    }
  })

vi.mock('@/components/BCDataGrid/BCDataGridServer', () => ({
    __esModule: true,
    default: () => <div data-test="mocked-data-grid"></div>
  }))

vi.mock('@/components/Role', () => ({
  Role: ({ children }) => <div data-test="role-component">{children}</div>
}))

vi.mock('@/services/useApiService', () => ({
    useApiService: () => ({
      download: mockDownload
    })
  }))

vi.mock('@/components/BCAlert', () => ({
  default: (props) => {
    return <div data-test="alert-box">{props.children || props.message}</div>;
  }
}))

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
        'common:clearFiltersButton': 'Clear Filters',
        'common:ClearFilters': 'Clear Filters' // Add this line
      }
      return translations[key] || key
    }
  })
}))

describe('Organizations Component', () => {
  beforeEach(() => {
    mockLocationValue.state = null
    mockDownload.mockReset().mockResolvedValue({})
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('renders the component with correct title', () => {
    render(<Organizations />, { wrapper })
    expect(screen.getByText('Organizations')).toBeInTheDocument()
    expect(screen.getByTestId('mocked-data-grid')).toBeInTheDocument()
  })

  it('navigates to add organization page when add button is clicked', async () => {
    render(<Organizations />, { wrapper })

    await waitFor(() => screen.getByText('Add Organization'))
    const addButton = screen.getByText('Add Organization')

    await act(async () => {
      fireEvent.click(addButton)
    })

    expect(navigateMock).toHaveBeenCalledWith(ROUTES.ORGANIZATIONS.ADD)
  })

  it('handles organization download correctly', async () => {
    render(<Organizations />, { wrapper })

    await waitFor(() => screen.getByText('Download Organizations'))
    const downloadOrgButton = screen.getByText('Download Organizations')

    await act(async () => {
      fireEvent.click(downloadOrgButton)
    })

    expect(mockDownload).toHaveBeenCalled()
  })

  it('handles user download correctly', async () => {
    render(<Organizations />, { wrapper })

    await waitFor(() => screen.getByText('Download Users'))
    const downloadUserButton = screen.getByText('Download Users')

    await act(async () => {
      fireEvent.click(downloadUserButton)
    })

    expect(mockDownload).toHaveBeenCalled()
  })

  it('shows error alert when organization download fails', async () => {
    mockDownload.mockRejectedValueOnce(new Error('Download failed'))

    render(<Organizations />, { wrapper })

    await waitFor(() => screen.getByText('Download Organizations'))
    const downloadOrgButton = screen.getByText('Download Organizations')

    await act(async () => {
      fireEvent.click(downloadOrgButton)
    })

    await waitFor(() => {
      const alertBox = screen.getByTestId('alert-box')
      expect(alertBox).toBeInTheDocument()
      expect(alertBox.textContent).toContain('Failed to download organization information.')
    })
  })

  it('includes clear filters button', () => {
    render(<Organizations />, { wrapper })

    const clearFiltersButton = screen.getByText('Clear Filters')
    expect(clearFiltersButton).toBeInTheDocument()
  })

  it('shows add organization button for admin users', async () => {
    // Mock the Role component to simulate admin access
    vi.mock('@/components/Role', () => ({
      Role: ({ children, roles }) => {
        // Simulate admin role check passing
        return <div data-test="role-component" data-roles={roles.join(',')}>
          {children}
        </div>
      }
    }))

    render(<Organizations />, { wrapper })

    const roleComponent = screen.getByTestId('role-component')
    expect(roleComponent).toBeInTheDocument()
    expect(roleComponent.getAttribute('data-roles')).toContain('Administrator')

    const addButton = screen.getByText('Add Organization')
    expect(addButton).toBeInTheDocument()
  })

})
