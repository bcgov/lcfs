import React from 'react'
import { afterEach, beforeEach, describe, expect, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'

import { CIApplications } from '@/views/CarbonIntensity/CIApplications'
import { roles } from '@/constants/roles'
import { test } from '@/tests/utils/fixtures'
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
    data: { roles: mockUserRoles, organization: { organizationId: 1 } },
    hasRoles: (...names) =>
      names.every((n) => mockUserRoles.some((r) => r.name === n)),
    hasAnyRole: (...names) =>
      names.some((n) => mockUserRoles.some((r) => r.name === n))
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
  error: null,
  refetch: vi.fn()
}

vi.mock('@/hooks/useCIApplication', () => ({
  useGetCIApplications: vi.fn(() => mockListData),
  useCIApplicationStatuses: vi.fn(() => ({ data: [], isLoading: false })),
  useGetCIApplicationAnalysts: vi.fn(() => ({ data: [], isLoading: false }))
}))

// ---------------- Tests ----------------

describe('CIApplications listing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserRoles = [{ name: roles.ci_applicant }]
    mockLocation.state = null
  })

  afterEach(cleanup)

  test('renders the title and grid for an authorized user', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<CIApplications />, [query, theme, localization, router])
    await waitFor(() => {
      expect(screen.getByTestId('title')).toBeInTheDocument()
      expect(screen.getByTestId('bc-grid-container')).toBeInTheDocument()
    })
  })

  test('shows the "New CI application" button for ci_applicant role', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<CIApplications />, [query, theme, localization, router])
    await waitFor(() => {
      expect(screen.getByTestId('new-ci-application-btn')).toBeInTheDocument()
    })
  })

  test('navigates to the add page when "New CI application" is clicked', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<CIApplications />, [query, theme, localization, router])
    const btn = await screen.findByTestId('new-ci-application-btn')
    fireEvent.click(btn)
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.CI_APPLICATIONS.ADD)
  })

  test('hides the new button for government users', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.government }]
    render(<CIApplications />, [query, theme, localization, router])
    await waitFor(() => {
      expect(
        screen.queryByTestId('new-ci-application-btn')
      ).not.toBeInTheDocument()
      // grid still visible
      expect(screen.getByTestId('bc-grid-container')).toBeInTheDocument()
    })
  })

  test('redirects unauthorized users to dashboard', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: 'IA Proponent' }]
    const { container } = render(<CIApplications />, [
      query,
      theme,
      localization,
      router
    ])
    // withRole returns <Navigate /> which renders nothing in test env
    await waitFor(() => {
      expect(container.querySelector('[data-test="title"]')).toBeNull()
    })
  })

  test('redirects a signing authority without the CI Applicant role to dashboard', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.signing_authority }]
    const { container } = render(<CIApplications />, [
      query,
      theme,
      localization,
      router
    ])
    // withRole returns <Navigate /> which renders nothing in test env
    await waitFor(() => {
      expect(container.querySelector('[data-test="title"]')).toBeNull()
    })
  })

  test('surfaces errors via the alert box', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockListData = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: 'Network error' },
      refetch: vi.fn()
    }
    render(<CIApplications />, [query, theme, localization, router])
    await waitFor(() => {
      expect(screen.getByTestId('alert-box')).toBeInTheDocument()
      expect(screen.getByTestId('alert-box').textContent).toContain(
        'Network error'
      )
    })
    // restore default
    mockListData = {
      data: {
        ciApplications: [],
        pagination: { total: 0, page: 1, size: 10, totalPages: 0 }
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn()
    }
  })

  test('shows an alert when location.state.message is set', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockLocation.state = { message: 'Saved!', severity: 'success' }
    render(<CIApplications />, [query, theme, localization, router])
    await waitFor(() => {
      expect(screen.getByTestId('alert-box').textContent).toContain('Saved!')
    })
  })
})
