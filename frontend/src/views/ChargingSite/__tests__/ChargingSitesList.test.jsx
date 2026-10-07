import React from 'react'
import { describe, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChargingSitesList } from '../ChargingSitesList'
import { test } from '@/tests/utils/fixtures'

const mockNavigate = vi.fn()
const mockUseLocation = vi.fn()
const mockUseOutletContext = vi.fn()

vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockUseLocation(),
    useOutletContext: () => mockUseOutletContext(),
    Outlet: () => <div data-testid="nested-route">Nested Route Content</div>
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock the map component
vi.mock('../components/ChargingSitesMap', () => ({
  __esModule: true,
  default: ({ sites, showLegend, height }) => (
    <div data-testid="charging-sites-map">
      Map - Sites: {sites?.length || 0}, Legend: {showLegend ? 'Yes' : 'No'},
      Height: {height}
    </div>
  )
}))

// Mock grid to keep tests focused
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: React.forwardRef((props, ref) => (
    <div
      data-testid="bc-grid-viewer"
      onClick={() => props.onRowClicked?.({ data: { chargingSiteId: 123 } })}
    >
      Grid - Page: {props.paginationOptions?.page}, Size:{' '}
      {props.paginationOptions?.size}
    </div>
  ))
}))

// Mock the clear filters button
vi.mock('@/components/ClearFiltersButton', () => ({
  ClearFiltersButton: ({ onClick }) => (
    <button onClick={onClick} data-testid="clear-filters-btn">
      common:ClearFilters
    </button>
  )
}))

// Module-scoped controllable mocks
let orgNamesData = []
let orgNamesLoading = false
vi.mock('@/hooks/useOrganizations', () => ({
  useOrganizationNames: () => ({
    data: orgNamesData,
    isLoading: orgNamesLoading
  })
}))

let chargingSitesData = {
  chargingSites: [],
  pagination: { page: 1, size: 10, total: 0, totalPages: 1 }
}

vi.mock('@/hooks/useChargingSite', () => ({
  useGetAllChargingSites: () => ({ data: chargingSitesData, isLoading: false }),
  useChargingSiteStatuses: () => ({
    data: [
      { id: 'draft', status: 'Draft' },
      { id: 'validated', status: 'Validated' }
    ],
    isLoading: false
  })
}))

vi.mock('@/hooks/useCurrentUser')
import { useCurrentUser } from '@/hooks/useCurrentUser'

// Mock sessionStorage
const mockSessionStorage = (() => {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value
    }),
    removeItem: vi.fn((key) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    })
  }
})()
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage })

describe('ChargingSitesList', () => {
  let mockAlertRef
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.clear()

    // Default location mock
    mockUseLocation.mockReturnValue({
      pathname: '/compliance-reporting/charging-sites',
      state: null
    })
    mockAlertRef = { current: { triggerAlert: vi.fn() } }
    mockUseOutletContext.mockReturnValue({ alertRef: mockAlertRef })

    // Default mocks
    orgNamesData = [
      { organizationId: 1, name: 'Organization 1' },
      { organizationId: 2, name: 'Organization 2' }
    ]
    orgNamesLoading = false
    chargingSitesData = {
      chargingSites: [
        { chargingSiteId: 1, siteName: 'Site 1', organizationId: 1 },
        { chargingSiteId: 2, siteName: 'Site 2', organizationId: 2 }
      ],
      pagination: { page: 1, size: 10, total: 2, totalPages: 1 }
    }
  })

  describe('IDIR User View', () => {
    beforeEach(() => {
      useCurrentUser.mockReturnValue({
        hasAnyRole: () => true,
        data: { organization: { organizationId: 1 } }
      })
    })

    test('renders IDIR view with all components', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<ChargingSitesList />, [query, theme, localization, router])

      expect(screen.getByText('chargingSitesTitle')).toBeInTheDocument()
      expect(screen.getByText('csDescription')).toBeInTheDocument()
      expect(screen.getByText(/Grid - Page: 1, Size: 10/)).toBeInTheDocument()
      // Check map components separately to handle text splitting
      expect(screen.getByText(/Map - Sites: 2/)).toBeInTheDocument()
      expect(screen.getByText(/Legend: No/)).toBeInTheDocument()
      expect(screen.getByText(/Height: 500/)).toBeInTheDocument()
    })

    test('shows success alert when location state contains a message', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      mockUseLocation.mockReturnValue({
        pathname: '/compliance-reporting/charging-sites',
        state: { message: 'Deleted', severity: 'success' }
      })

      render(<ChargingSitesList />, [query, theme, localization, router])

      await waitFor(() =>
        expect(mockAlertRef.current.triggerAlert).toHaveBeenCalledWith({
          message: 'Deleted',
          severity: 'success'
        })
      )
      expect(mockNavigate).toHaveBeenCalledWith(
        '/compliance-reporting/charging-sites',
        { replace: true }
      )
    })

    test('restores organization selection from sessionStorage', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      mockSessionStorage.getItem.mockReturnValue(
        '{"id":1,"label":"Organization 1"}'
      )

      render(<ChargingSitesList />, [query, theme, localization, router])

      expect(mockSessionStorage.getItem).toHaveBeenCalledWith(
        'selectedOrganization'
      )
    })

    test('handles invalid sessionStorage data gracefully', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      mockSessionStorage.getItem.mockReturnValue('invalid-json')

      expect(() => {
        render(<ChargingSitesList />, [query, theme, localization, router])
      }).not.toThrow()
    })

    test('does not show new site button for IDIR users', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<ChargingSitesList />, [query, theme, localization, router])

      expect(screen.queryByText('newSiteBtn')).not.toBeInTheDocument()
    })
  })

  describe('BCeID User View', () => {
    beforeEach(() => {
      useCurrentUser.mockReturnValue({
        hasAnyRole: () => false,
        data: { organization: { organizationId: 1 } }
      })
    })

    test('renders BCeID view with new site button', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<ChargingSitesList />, [query, theme, localization, router])

      expect(screen.getByText('mngTitle')).toBeInTheDocument()
      expect(screen.getByText('mngCSdescription')).toBeInTheDocument()
      expect(screen.getByText('newSiteBtn')).toBeInTheDocument()
    })

    test('navigates to add new site when button clicked', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const user = userEvent.setup()
      render(<ChargingSitesList />, [query, theme, localization, router])

      const newSiteButton = screen.getByText('newSiteBtn')
      await user.click(newSiteButton)

      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('add'))
    })
  })

  describe('Row Click Navigation', () => {
    beforeEach(() => {
      useCurrentUser.mockReturnValue({
        hasAnyRole: () => true,
        data: { organization: { organizationId: 1 } }
      })
    })

    test('navigates to view site when grid row is clicked', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const user = userEvent.setup()
      render(<ChargingSitesList />, [query, theme, localization, router])

      const grid = screen.getByText(/Grid - Page: 1, Size: 10/)
      await user.click(grid)

      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('123'))
    })
  })

  describe('Loading States', () => {
    test('handles organization loading state', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      orgNamesLoading = true
      useCurrentUser.mockReturnValue({
        hasAnyRole: () => true,
        data: { organization: { organizationId: 1 } }
      })

      render(<ChargingSitesList />, [query, theme, localization, router])

      expect(screen.getByText('chargingSitesTitle')).toBeInTheDocument()
    })

    test('handles empty organizations list', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      orgNamesData = []
      useCurrentUser.mockReturnValue({
        hasAnyRole: () => true,
        data: { organization: { organizationId: 1 } }
      })

      render(<ChargingSitesList />, [query, theme, localization, router])

      expect(screen.getByText('chargingSitesTitle')).toBeInTheDocument()
    })

    test('handles empty charging sites data', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      chargingSitesData = {
        chargingSites: [],
        pagination: { page: 1, size: 10, total: 0, totalPages: 1 }
      }
      useCurrentUser.mockReturnValue({
        hasAnyRole: () => true,
        data: { organization: { organizationId: 1 } }
      })

      render(<ChargingSitesList />, [query, theme, localization, router])

      expect(screen.getByText(/Map - Sites: 0/)).toBeInTheDocument()
    })
  })

  describe('Map Component Integration', () => {
    beforeEach(() => {
      useCurrentUser.mockReturnValue({
        hasAnyRole: () => true,
        data: { organization: { organizationId: 1 } }
      })
    })

    test('passes correct props to map component', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<ChargingSitesList />, [query, theme, localization, router])

      // Check individual parts since text might be split
      expect(screen.getByText(/Map - Sites: 2/)).toBeInTheDocument()
      expect(screen.getByText(/Legend: No/)).toBeInTheDocument()
      expect(screen.getByText(/Height: 500/)).toBeInTheDocument()
    })

    test('updates map when charging sites data changes', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const { rerender } = render(<ChargingSitesList />, [
        query,
        theme,
        localization,
        router
      ])

      chargingSitesData = {
        chargingSites: [{ chargingSiteId: 1, siteName: 'Site 1' }],
        pagination: { page: 1, size: 10, total: 1, totalPages: 1 }
      }

      rerender(<ChargingSitesList />)

      expect(screen.getByText(/Map - Sites: 1/)).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    test('handles missing user organization gracefully', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useCurrentUser.mockReturnValue({
        hasAnyRole: () => false,
        data: { organization: null }
      })

      expect(() => {
        render(<ChargingSitesList />, [query, theme, localization, router])
      }).not.toThrow()
    })

    test('handles missing charging sites data gracefully', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      chargingSitesData = null
      useCurrentUser.mockReturnValue({
        hasAnyRole: () => true,
        data: { organization: { organizationId: 1 } }
      })

      expect(() => {
        render(<ChargingSitesList />, [query, theme, localization, router])
      }).not.toThrow()
    })
  })
})
