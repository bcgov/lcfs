import { screen } from '@testing-library/react'
import Crumb from '../Crumb'
import { vi, describe, expect, type Mock } from 'vitest'
import { test } from '@/tests/utils/fixtures'
import { useLocation, useMatches, useParams } from 'react-router-dom'
import { useOrganizationPageStore } from '@/stores/useOrganizationPageStore'

// Mock router hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useLocation: vi.fn(),
    useMatches: vi.fn(),
    useParams: vi.fn()
  }
})

const mockedUseLocation = useLocation as unknown as Mock
const mockedUseMatches = useMatches as unknown as Mock
const mockedUseParams = useParams as unknown as Mock

type RouterMockOptions = {
  pathname?: string
  matches?: Array<{ handle?: { title?: string } }>
  params?: Record<string, string>
}

describe('Crumb', () => {
  // Helper to set up the router mocks
  const setupRouterMocks = ({
    pathname = '/',
    matches = [{ handle: {} }],
    params = {}
  }: RouterMockOptions = {}) => {
    mockedUseLocation.mockReturnValue({ pathname })
    mockedUseMatches.mockReturnValue(matches)
    mockedUseParams.mockReturnValue(params)
  }

  test.beforeEach(() => {
    setupRouterMocks()
    useOrganizationPageStore.getState().resetOrganizationContext()
  })

  test.afterEach(() => {
    useOrganizationPageStore.getState().resetOrganizationContext()
  })

  test('renders the home link when on a path', ({
    render,
    query,
    theme,
    router
  }) => {
    setupRouterMocks({ pathname: '/admin' })

    render(<Crumb />, [query, theme, router])

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Administration')).toBeInTheDocument()
  })

  test('does not render breadcrumb items when on the home path', ({
    render,
    query,
    theme,
    router
  }) => {
    setupRouterMocks({ pathname: '/' })

    const { container } = render(<Crumb />, [query, theme, router])

    // Verify that breadcrumb nav exists but has no items
    const breadcrumb = container.querySelector('[aria-label="breadcrumb"]')
    expect(breadcrumb).toBeInTheDocument()
    // The breadcrumbs ol might still render, but should be empty
    const items = container.querySelectorAll('.MuiBreadcrumbs-li')
    expect(items.length).toBe(0)
  })

  test('displays custom breadcrumb for admin path', ({
    render,
    query,
    theme,
    router
  }) => {
    setupRouterMocks({ pathname: '/admin' })

    render(<Crumb />, [query, theme, router])

    expect(screen.getByText('Administration')).toBeInTheDocument()
  })

  test('displays the title from route metadata when available', ({
    render,
    query,
    theme,
    router
  }) => {
    setupRouterMocks({
      pathname: '/admin',
      matches: [{ handle: { title: 'Admin Dashboard' } }]
    })

    render(<Crumb />, [query, theme, router])

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
  })

  test('displays numeric IDs with ID prefix', ({
    render,
    query,
    theme,
    router
  }) => {
    setupRouterMocks({
      pathname: '/transactions/12345',
      matches: [{ handle: {} }]
    })

    render(<Crumb />, [query, theme, router])

    expect(screen.getByText('ID: 12345')).toBeInTheDocument()
  })

  test('displays user profile breadcrumb for user ID with edit', ({
    render,
    query,
    theme,
    router
  }) => {
    setupRouterMocks({
      pathname: '/users/789/edit-user',
      params: { userID: '789' }
    })

    render(<Crumb />, [query, theme, router])

    expect(screen.getByText('User profile')).toBeInTheDocument()
  })

  test('displays organization ID in breadcrumb', ({
    render,
    query,
    theme,
    router
  }) => {
    setupRouterMocks({
      pathname: '/organizations/456',
      params: { orgID: '456' }
    })

    render(<Crumb />, [query, theme, router])

    expect(screen.getByText('ID: 456')).toBeInTheDocument()
    expect(screen.getByText('Organizations')).toBeInTheDocument()
  })

  test('shows organization name with active tab when context is set', ({
    render,
    query,
    theme,
    router
  }) => {
    setupRouterMocks({
      pathname: '/organizations/456/users',
      params: { orgID: '456' },
      matches: [{ handle: { title: 'Organization users' } }]
    })

    useOrganizationPageStore.getState().setOrganizationContext({
      organizationName: 'LCFS Org 1',
      activeTabLabel: 'Users'
    })

    render(<Crumb />, [query, theme, router])

    expect(screen.getByText('LCFS Org 1 - Users')).toBeInTheDocument()
    expect(screen.queryByText('Organization profile')).not.toBeInTheDocument()
  })

  test('handles compliance report paths correctly', ({
    render,
    query,
    theme,
    router
  }) => {
    setupRouterMocks({
      pathname: '/compliance-reporting/2023/123',
      params: {
        compliancePeriod: '2023',
        complianceReportId: '123'
      }
    })

    render(<Crumb />, [query, theme, router])

    expect(screen.getByText('Compliance reporting')).toBeInTheDocument()
    expect(screen.getByText('2023 Compliance report')).toBeInTheDocument()
  })
})
