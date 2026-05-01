import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { CIApplications } from '@/views/CarbonIntensity/CIApplications'
import { roles } from '@/constants/roles'
import { wrapper } from '@/tests/utils/wrapper'
import { ROUTES } from '@/routes/routes'

// ---------------- Mocks ----------------

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: { authenticated: true, initialized: true, token: 'test' }
  })
}))

let mockUserRoles = [{ name: roles.ci_applicant }]
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { roles: mockUserRoles, organization: { organizationId: 1 } }
  })
}))

vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: ({ overlayNoRowsTemplate, dataKey }) => (
    <div data-test="bc-grid-container" data-grid-key={dataKey}>
      {overlayNoRowsTemplate}
    </div>
  )
}))

const mockNavigate = vi.fn()
const mockLocation = { state: null, pathname: ROUTES.CI_APPLICATIONS.LIST }
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation
  }
})

let mockListData = {
  data: {
    ciApplications: [],
    pagination: { total: 0, page: 1, size: 10, totalPages: 0 }
  },
  isLoading: false,
  isError: false,
  error: null
}

vi.mock('@/hooks/useCIApplication', () => ({
  useGetCIApplications: vi.fn(() => mockListData)
}))

// ---------------- Tests ----------------

describe('CIApplications listing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserRoles = [{ name: roles.ci_applicant }]
    mockLocation.state = null
  })

  afterEach(cleanup)

  it('renders the title and grid for an authorized user', async () => {
    render(<CIApplications />, { wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('title')).toBeInTheDocument()
      expect(screen.getByTestId('bc-grid-container')).toBeInTheDocument()
    })
  })

  it('shows the "New CI application" button for ci_applicant role', async () => {
    render(<CIApplications />, { wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('new-ci-application-btn')).toBeInTheDocument()
    })
  })

  it('navigates to the add page when "New CI application" is clicked', async () => {
    render(<CIApplications />, { wrapper })
    const btn = await screen.findByTestId('new-ci-application-btn')
    fireEvent.click(btn)
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.CI_APPLICATIONS.ADD)
  })

  it('hides the new button for government users', async () => {
    mockUserRoles = [{ name: roles.government }]
    render(<CIApplications />, { wrapper })
    await waitFor(() => {
      expect(screen.queryByTestId('new-ci-application-btn')).not.toBeInTheDocument()
      // grid still visible
      expect(screen.getByTestId('bc-grid-container')).toBeInTheDocument()
    })
  })

  it('redirects unauthorized users to dashboard', async () => {
    mockUserRoles = [{ name: 'IA Proponent' }]
    const { container } = render(<CIApplications />, { wrapper })
    // withRole returns <Navigate /> which renders nothing in test env
    await waitFor(() => {
      expect(container.querySelector('[data-test="title"]')).toBeNull()
    })
  })

  it('surfaces errors via the alert box', async () => {
    mockListData = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: 'Network error' }
    }
    render(<CIApplications />, { wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('alert-box')).toBeInTheDocument()
      expect(screen.getByTestId('alert-box').textContent).toContain('Network error')
    })
    // restore default
    mockListData = {
      data: {
        ciApplications: [],
        pagination: { total: 0, page: 1, size: 10, totalPages: 0 }
      },
      isLoading: false,
      isError: false,
      error: null
    }
  })

  it('shows an alert when location.state.message is set', async () => {
    mockLocation.state = { message: 'Saved!', severity: 'success' }
    render(<CIApplications />, { wrapper })
    await waitFor(() => {
      expect(screen.getByTestId('alert-box').textContent).toContain('Saved!')
    })
  })
})
