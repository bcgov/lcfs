import { screen } from '@testing-library/react'
import Crumb from '../Crumb'
import { vi, describe, expect, type Mock } from 'vitest'
import { test } from '@/tests/utils/fixtures'
import { useLocation, useMatches, useParams } from 'react-router-dom'
import { useOrganizationPageStore } from '@/stores/useOrganizationPageStore'
import { useInitiativeAgreementPageStore } from '@/stores/useInitiativeAgreementPageStore'

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
    useInitiativeAgreementPageStore.getState().setAgreementCrumb(null)
    useInitiativeAgreementPageStore.getState().setParentCrumb(null)
  })

  test.afterEach(() => {
    useOrganizationPageStore.getState().resetOrganizationContext()
    useInitiativeAgreementPageStore.getState().setAgreementCrumb(null)
    useInitiativeAgreementPageStore.getState().setParentCrumb(null)
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

  test('shows the agreement code for an initiative agreement detail path', ({
    render,
    app
  }) => {
    setupRouterMocks({
      pathname: '/initiative-agreements/5',
      matches: [{ handle: { title: 'Initiative agreement' } }]
    })
    useInitiativeAgreementPageStore.getState().setAgreementCrumb('IA-26ORG1')

    render(<Crumb />, app)

    expect(screen.getByText('Initiative agreements')).toBeInTheDocument()
    expect(screen.getByText('IA-26ORG1')).toBeInTheDocument()
  })

  test('reads a designated action trail as module, agreement, action', ({
    render,
    app
  }) => {
    setupRouterMocks({
      pathname: '/initiative-agreements/5/designated-actions/9',
      matches: [{ handle: { title: 'Designated action' } }]
    })
    useInitiativeAgreementPageStore.getState().setAgreementCrumb('DA1-IA5')
    useInitiativeAgreementPageStore.getState().setParentCrumb('IA-26ORG1')

    render(<Crumb />, app)

    expect(screen.getByText('Initiative agreements')).toBeInTheDocument()
    const agreement = screen.getByText('IA-26ORG1')
    expect(agreement.closest('a')).toHaveAttribute(
      'href',
      '/initiative-agreements/5'
    )
    expect(screen.queryByText('Designated actions')).not.toBeInTheDocument()
    expect(screen.queryByText('ID: 5')).not.toBeInTheDocument()
    expect(screen.getByText('DA1-IA5')).toBeInTheDocument()
  })

  test('falls back to the agreement id while its code is still loading', ({
    render,
    app
  }) => {
    setupRouterMocks({
      pathname: '/initiative-agreements/5/designated-actions/9',
      matches: [{ handle: { title: 'Designated action' } }]
    })

    render(<Crumb />, app)

    expect(screen.getByText('IA5').closest('a')).toHaveAttribute(
      'href',
      '/initiative-agreements/5'
    )
  })

  test('keeps the crumb for the module-wide Designated actions tab', ({
    render,
    app
  }) => {
    setupRouterMocks({
      pathname: '/initiative-agreements/designated-actions',
      matches: [{ handle: { title: 'Designated actions' } }]
    })

    render(<Crumb />, app)

    expect(screen.getByText('Initiative agreements')).toBeInTheDocument()
    expect(screen.getByText('Designated actions')).toBeInTheDocument()
  })

  test('falls back to the route title when no agreement code is set', ({
    render,
    app
  }) => {
    setupRouterMocks({
      pathname: '/initiative-agreements/5',
      matches: [{ handle: { title: 'Initiative agreement' } }]
    })

    render(<Crumb />, app)

    expect(screen.getByText('Initiative agreement')).toBeInTheDocument()
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
