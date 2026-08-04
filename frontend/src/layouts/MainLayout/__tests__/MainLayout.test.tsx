import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { useLocation } from 'react-router-dom'
import { MainLayout } from '../MainLayout'
import { isFeatureEnabled } from '@/constants/config'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('@/constants/config', async () => {
  const actual = await vi.importActual<typeof import('@/constants/config')>(
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
  beforeEach(() => {
    mockedUseLocation.mockReset()
    mockedIsFeatureEnabled.mockReset()
  })

  it('redirects root visitors to the Credit Market public dashboard when the feature flag is enabled', () => {
    mockedUseLocation.mockReturnValue({ pathname: '/' })
    mockedIsFeatureEnabled.mockReturnValue(true)

    render(<MainLayout />, { wrapper })

    expect(screen.getByTestId('require-auth')).toHaveAttribute(
      'data-redirect-to',
      '/public'
    )
  })

  it('redirects root visitors to the standard login page when the feature flag is disabled', () => {
    mockedUseLocation.mockReturnValue({ pathname: '/' })
    mockedIsFeatureEnabled.mockReturnValue(false)

    render(<MainLayout />, { wrapper })

    expect(screen.getByTestId('require-auth')).toHaveAttribute(
      'data-redirect-to',
      '/login'
    )
  })

  it('always redirects deep links to the standard login page regardless of the feature flag', () => {
    mockedUseLocation.mockReturnValue({ pathname: '/organizations' })
    mockedIsFeatureEnabled.mockReturnValue(true)

    render(<MainLayout />, { wrapper })

    expect(screen.getByTestId('require-auth')).toHaveAttribute(
      'data-redirect-to',
      '/login'
    )
  })
})
