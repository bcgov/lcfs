import { screen, fireEvent } from '@testing-library/react'
import { describe, expect, vi, beforeEach } from 'vitest'
import { test } from '@/tests/utils/fixtures'
import { ROUTES } from '@/routes/routes'
import { PublicDashboard } from '../PublicDashboard'

const loginMock = vi.fn()
const navigateMock = vi.fn()

vi.mock('echarts-for-react', () => ({ default: () => null }))

const keycloakState: {
  initialized: boolean
  authenticated: boolean
} = { initialized: false, authenticated: false }

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: { login: loginMock, authenticated: keycloakState.authenticated },
    initialized: keycloakState.initialized
  })
}))

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const mockData = {
  interval: 'quarter',
  latestVwap: 395,
  totalVolumeTraded: 1420000,
  outstandingCredits: 6800000,
  participatingOrganizations: 180,
  totalCreditsIssued: 9200000,
  priceIndex: [
    { period: '2024-Q1', vwap: 360, low: 335, high: 388, volume: 500000 },
    { period: '2024-Q2', vwap: 395, low: 372, high: 420, volume: 620000 }
  ]
}

vi.mock('@/hooks/useCreditMarket', () => ({
  useCreditMarketPublicOverview: () => ({ data: mockData })
}))

vi.mock('@/hooks/useLoginBgImage', () => ({
  useActiveLoginBgImage: () => ({ data: undefined })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('PublicDashboard', () => {
  beforeEach(() => {
    keycloakState.initialized = false
    keycloakState.authenticated = false
    navigateMock.mockReset()
    sessionStorage.clear()
  })

  test('forwards a just-authenticated visitor into the app dashboard', ({
    render,
    theme,
    router
  }) => {
    keycloakState.initialized = true
    keycloakState.authenticated = true
    render(<PublicDashboard />, [theme, router])
    expect(navigateMock).toHaveBeenCalledWith(ROUTES.DASHBOARD, {
      replace: true
    })
  })

  test('forwards only once so it cannot loop with the auth guard', ({
    render,
    theme,
    router
  }) => {
    keycloakState.initialized = true
    keycloakState.authenticated = true
    // First mount forwards; a re-render (e.g. RequireAuth bounced the visitor
    // straight back, as happens for an authenticated user with no LCFS
    // account) must not forward again.
    const { unmount } = render(<PublicDashboard />, [theme, router])
    expect(navigateMock).toHaveBeenCalledTimes(1)
    unmount()
    render(<PublicDashboard />, [theme, router])
    expect(navigateMock).toHaveBeenCalledTimes(1)
  })

  test('does not forward an unauthenticated visitor', ({
    render,
    theme,
    router
  }) => {
    keycloakState.initialized = true
    keycloakState.authenticated = false
    render(<PublicDashboard />, [theme, router])
    expect(navigateMock).not.toHaveBeenCalled()
  })

  test('does not forward before keycloak has initialized', ({
    render,
    theme,
    router
  }) => {
    keycloakState.initialized = false
    keycloakState.authenticated = true
    render(<PublicDashboard />, [theme, router])
    expect(navigateMock).not.toHaveBeenCalled()
  })

  test('renders the hero and program title', ({ render, theme, router }) => {
    render(<PublicDashboard />, [theme, router])
    expect(screen.getByText('publicDashboard.hero.title')).toBeInTheDocument()
    expect(screen.getByText('publicDashboard.cardTitle')).toBeInTheDocument()
  })

  test('renders the public tool tiles', ({ render, theme, router }) => {
    render(<PublicDashboard />, [theme, router])
    expect(screen.getByTestId('tool-calculator')).toBeInTheDocument()
    expect(screen.getByTestId('tool-calculationData')).toBeInTheDocument()
    expect(
      screen.getByTestId('tool-approvedCarbonIntensities')
    ).toBeInTheDocument()
  })

  test('renders tool tiles as accessible links to their routes', ({
    render,
    theme,
    router
  }) => {
    render(<PublicDashboard />, [theme, router])
    expect(screen.getByTestId('tool-calculator')).toHaveAttribute(
      'href',
      '/credit-calculator'
    )
  })

  test('links to the BC Gov legislation and requirements pages', ({
    render,
    theme,
    router
  }) => {
    render(<PublicDashboard />, [theme, router])
    const links = screen.getAllByTestId('legislation-link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute(
      'href',
      expect.stringContaining('renewable-low-carbon-fuels')
    )
    expect(links[1]).toHaveAttribute(
      'href',
      expect.stringContaining('/requirements')
    )
  })

  test('triggers keycloak login from the login buttons', ({
    render,
    theme,
    router
  }) => {
    render(<PublicDashboard />, [theme, router])
    fireEvent.click(screen.getAllByTestId('public-login-bceid')[0])
    expect(loginMock).toHaveBeenCalledWith(
      expect.objectContaining({ idpHint: 'bceidbusiness' })
    )
  })
})
