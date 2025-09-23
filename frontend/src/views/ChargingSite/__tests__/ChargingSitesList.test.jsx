import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChargingSitesList } from '../ChargingSitesList'
import { wrapper } from '@/tests/utils/wrapper.jsx'

const mockNavigate = vi.fn()
const mockUseLocation = vi.fn()

vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockUseLocation(),
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
vi.mock('@/components/BCDataGrid/BCGridViewer.jsx', () => ({
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
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.clear()

    // Default location mock
    mockUseLocation.mockReturnValue({
      pathname: '/compliance-reporting/charging-sites'
    })

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

    it('renders IDIR view with all components', () => {
      render(<ChargingSitesList />, { wrapper })

      expect(screen.getByText('chargingSitesTitle')).toBeInTheDocument()
      expect(screen.getByText('csDescription')).toBeInTheDocument()
      expect(screen.getByText('common:ClearFilters')).toBeInTheDocument()
      expect(screen.getByText('filtersLabel')).toBeInTheDocument()
      expect(
        screen.getByPlaceholderText('selectOrgPlaceholder')
      ).toBeInTheDocument()
      expect(screen.getByText(/Grid - Page: 1, Size: 10/)).toBeInTheDocument()
      // Check map components separately to handle text splitting
      expect(screen.getByText(/Map - Sites: 2/)).toBeInTheDocument()
      expect(screen.getByText(/Legend: No/)).toBeInTheDocument()
      expect(screen.getByText(/Height: 500/)).toBeInTheDocument()
    })

    it('handles organization dropdown selection', async () => {
      const user = userEvent.setup()
      render(<ChargingSitesList />, { wrapper })

      const autocomplete = screen.getByRole('combobox')
      await user.click(autocomplete)

      expect(autocomplete).toBeInTheDocument()
    })

    it('handles clear filters button click', async () => {
      const user = userEvent.setup()
      render(<ChargingSitesList />, { wrapper })

      const clearButton = screen.getByText('common:ClearFilters')
      await user.click(clearButton)

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        'selectedOrganization'
      )
    })

    it('restores organization selection from sessionStorage', () => {
      mockSessionStorage.getItem.mockReturnValue(
        '{"id":1,"label":"Organization 1"}'
      )

      render(<ChargingSitesList />, { wrapper })

      expect(mockSessionStorage.getItem).toHaveBeenCalledWith(
        'selectedOrganization'
      )
    })

    it('handles invalid sessionStorage data gracefully', () => {
      mockSessionStorage.getItem.mockReturnValue('invalid-json')

      expect(() => {
        render(<ChargingSitesList />, { wrapper })
      }).not.toThrow()
    })

    it('does not show new site button for IDIR users', () => {
      render(<ChargingSitesList />, { wrapper })

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

    it('renders BCeID view with new site button', () => {
      render(<ChargingSitesList />, { wrapper })

      expect(screen.getByText('mngTitle')).toBeInTheDocument()
      expect(screen.getByText('mngCSdescription')).toBeInTheDocument()
      expect(screen.getByText('newSiteBtn')).toBeInTheDocument()
      expect(screen.queryByText('filtersLabel')).not.toBeInTheDocument()
    })

    it('navigates to add new site when button clicked', async () => {
      const user = userEvent.setup()
      render(<ChargingSitesList />, { wrapper })

      const newSiteButton = screen.getByText('newSiteBtn')
      await user.click(newSiteButton)

      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('add'))
    })

    it('still shows clear filters button for BCeID users', () => {
      render(<ChargingSitesList />, { wrapper })

      expect(screen.getByText('common:ClearFilters')).toBeInTheDocument()
    })
  })

  describe('Row Click Navigation', () => {
    beforeEach(() => {
      useCurrentUser.mockReturnValue({
        hasAnyRole: () => true,
        data: { organization: { organizationId: 1 } }
      })
    })

    it('navigates to view site when grid row is clicked', async () => {
      const user = userEvent.setup()
      render(<ChargingSitesList />, { wrapper })

      const grid = screen.getByText(/Grid - Page: 1, Size: 10/)
      await user.click(grid)

      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('123'))
    })
  })

  describe('Loading States', () => {
    it('handles organization loading state', () => {
      orgNamesLoading = true
      useCurrentUser.mockReturnValue({
        hasAnyRole: () => true,
        data: { organization: { organizationId: 1 } }
      })

      render(<ChargingSitesList />, { wrapper })

      expect(screen.getByText('chargingSitesTitle')).toBeInTheDocument()
    })

    it('handles empty organizations list', () => {
      orgNamesData = []
      useCurrentUser.mockReturnValue({
        hasAnyRole: () => true,
        data: { organization: { organizationId: 1 } }
      })

      render(<ChargingSitesList />, { wrapper })

      expect(screen.getByText('chargingSitesTitle')).toBeInTheDocument()
    })

    it('handles empty charging sites data', () => {
      chargingSitesData = {
        chargingSites: [],
        pagination: { page: 1, size: 10, total: 0, totalPages: 1 }
      }
      useCurrentUser.mockReturnValue({
        hasAnyRole: () => true,
        data: { organization: { organizationId: 1 } }
      })

      render(<ChargingSitesList />, { wrapper })

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

    it('passes correct props to map component', () => {
      render(<ChargingSitesList />, { wrapper })

      // Check individual parts since text might be split
      expect(screen.getByText(/Map - Sites: 2/)).toBeInTheDocument()
      expect(screen.getByText(/Legend: No/)).toBeInTheDocument()
      expect(screen.getByText(/Height: 500/)).toBeInTheDocument()
    })

    it('updates map when charging sites data changes', () => {
      const { rerender } = render(<ChargingSitesList />, { wrapper })

      chargingSitesData = {
        chargingSites: [{ chargingSiteId: 1, siteName: 'Site 1' }],
        pagination: { page: 1, size: 10, total: 1, totalPages: 1 }
      }

      rerender(<ChargingSitesList />)

      expect(screen.getByText(/Map - Sites: 1/)).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('handles missing user organization gracefully', () => {
      useCurrentUser.mockReturnValue({
        hasAnyRole: () => false,
        data: { organization: null }
      })

      expect(() => {
        render(<ChargingSitesList />, { wrapper })
      }).not.toThrow()
    })

    it('handles missing charging sites data gracefully', () => {
      chargingSitesData = null
      useCurrentUser.mockReturnValue({
        hasAnyRole: () => true,
        data: { organization: { organizationId: 1 } }
      })

      expect(() => {
        render(<ChargingSitesList />, { wrapper })
      }).not.toThrow()
    })
  })
})
