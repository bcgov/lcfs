import { screen } from '@testing-library/react'
import { describe, expect, vi, type Mock } from 'vitest'
import { useLocation } from 'react-router-dom'
import { MainLayout } from '../MainLayout'
import { isFeatureEnabled } from '@/constants/config'
import { test } from '@/tests/utils/fixtures'

vi.mock('@/constants/config', async () => {
  const actual =
    await vi.importActual<typeof import('@/constants/config')>(
      '@/constants/config'
    )
  return {
    ...actual,
    isFeatureEnabled: vi.fn()
  }
})

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useLocation: vi.fn(),
    useMatches: () => [{ handle: {} }],
    useNavigate: () => vi.fn()
  }
})

vi.mock('@/components/RequireAuth', () => ({
  RequireAuth: ({ redirectTo }: { redirectTo: string }) => (
    <div data-test="require-auth" data-redirect-to={redirectTo} />
  )
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ refreshToken: vi.fn() })
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: null })
}))

vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({ forbidden: false })
}))

vi.mock('@/stores/useLoadingStore', () => ({
  useLoadingStore: (selector: (state: { loading: boolean }) => unknown) =>
    selector({ loading: false })
}))

vi.mock('./components/Navbar', () => ({
  Navbar: () => <div data-test="navbar" />
}))

vi.mock('@/components/Footer', () => ({
  default: () => <div data-test="footer" />
}))

vi.mock('@/layouts/MainLayout/components/Crumb', () => ({
  default: () => <div data-test="crumb" />
}))

vi.mock('@/components/DisclaimerBanner', () => ({
  default: () => <div data-test="disclaimer-banner" />
}))

const mockedUseLocation = useLocation as unknown as Mock
const mockedIsFeatureEnabled = isFeatureEnabled as unknown as Mock

describe('MainLayout unauthenticated redirect target', () => {
  test.beforeEach(() => {
    mockedUseLocation.mockReset()
    mockedIsFeatureEnabled.mockReset()
  })

  test('redirects root visitors to the Credit Market public dashboard when the feature flag is enabled', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseLocation.mockReturnValue({ pathname: '/' })
    mockedIsFeatureEnabled.mockReturnValue(true)

    render(<MainLayout />, [query, theme, router])

    expect(screen.getByTestId('require-auth')).toHaveAttribute(
      'data-redirect-to',
      '/public'
    )
  })

  test('redirects root visitors to the standard login page when the feature flag is disabled', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseLocation.mockReturnValue({ pathname: '/' })
    mockedIsFeatureEnabled.mockReturnValue(false)

    render(<MainLayout />, [query, theme, router])

    expect(screen.getByTestId('require-auth')).toHaveAttribute(
      'data-redirect-to',
      '/login'
    )
  })

  test('always redirects deep links to the standard login page regardless of the feature flag', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseLocation.mockReturnValue({ pathname: '/organizations' })
    mockedIsFeatureEnabled.mockReturnValue(true)

    render(<MainLayout />, [query, theme, router])

    expect(screen.getByTestId('require-auth')).toHaveAttribute(
      'data-redirect-to',
      '/login'
    )
  })
})
