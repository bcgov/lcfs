import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChargingSitesList } from '../ChargingSitesList'
import { wrapper } from '@/tests/utils/wrapper.jsx'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/compliance-reporting/charging-sites' })
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock grid to keep tests focused
vi.mock('@/components/BCDataGrid/BCGridViewer.jsx', () => ({
  BCGridViewer: React.forwardRef((props, ref) => (
    <div data-test="bc-grid-viewer">Grid</div>
  ))
}))

// Module-scoped controllable mocks (avoid hoisting issues)
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
  useChargingSiteStatuses: () => ({ data: [], isLoading: false }),
  useChargingEquipmentStatuses: () => ({ data: [], isLoading: false })
}))

vi.mock('@/hooks/useCurrentUser')
import { useCurrentUser } from '@/hooks/useCurrentUser'

describe('ChargingSitesList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mocks
    orgNamesData = [{ organizationId: 1, name: 'Org 1' }]
    orgNamesLoading = false
    chargingSitesData = {
      chargingSites: [],
      pagination: { page: 1, size: 10, total: 0, totalPages: 1 }
    }
  })

  it('renders IDIR view with description, clear filters, org dropdown, and grid', () => {
    useCurrentUser.mockReturnValue({ hasAnyRole: () => true })

    render(<ChargingSitesList />, { wrapper })

    // Title and description
    expect(screen.getByText('chargingSitesTitle')).toBeInTheDocument()
    expect(screen.getByText('csDescription')).toBeInTheDocument()

    // Clear Filters button should be present
    expect(
      screen.getByRole('button', { name: /common:ClearFilters/i })
    ).toBeInTheDocument()

    // Org dropdown exists (placeholder text key)
    expect(
      screen.getByPlaceholderText('idirChargingSites.selectOrgPlaceholder')
    ).toBeInTheDocument()

    // Grid renders
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('renders BCeID view with new charging site button and no org dropdown', () => {
    useCurrentUser.mockReturnValue({ hasAnyRole: () => false })

    render(<ChargingSitesList />, { wrapper })

    // Title and description for BCeID
    expect(screen.getByText('mngTitle')).toBeInTheDocument()
    expect(screen.getByText('mngCSdescription')).toBeInTheDocument()

    // New charging site button
    const newBtn = screen.getByRole('button', {
      name: 'newSiteBtn'
    })
    expect(newBtn).toBeInTheDocument()

    // Clicking should navigate to add path
    fireEvent.click(newBtn)
    expect(mockNavigate).toHaveBeenCalled()

    // No org dropdown for BCeID
    expect(
      screen.queryByPlaceholderText('idirChargingSites.selectOrgPlaceholder')
    ).not.toBeInTheDocument()
  })
})
