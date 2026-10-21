import { screen, waitFor } from '@testing-library/react'
import { MainLayout } from '../MainLayout/MainLayout'
import { vi, describe, expect, type Mock } from 'vitest'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { test } from '@/tests/utils/fixtures'
import { useMatches, useNavigate } from 'react-router-dom'
import { useAuthorization } from '@/contexts/AuthorizationContext'
import { useLoadingStore } from '@/stores/useLoadingStore'
import { ROUTES } from '@/routes/routes'
import { useAuth } from '@/hooks/useAuth'
import type { ReactNode } from 'react'

// Mock all required hooks and components
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useMatches: vi.fn(),
    useNavigate: vi.fn(),
    Outlet: vi
      .fn()
      .mockReturnValue(<div data-test="outlet-content">Outlet Content</div>)
  }
})
vi.mock('@/hooks/useAuth')
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/contexts/AuthorizationContext')
vi.mock('@/stores/useLoadingStore')
vi.mock('../MainLayout/components/Navbar', () => ({
  Navbar: () => <div data-test="navbar-component">Navbar</div>
}))
vi.mock('../MainLayout/components/Crumb', () => ({
  __esModule: true,
  default: () => <div data-test="crumb-component">Breadcrumbs</div>
}))
vi.mock('@/components/Footer', () => ({
  __esModule: true,
  default: () => <div data-test="footer-component">Footer</div>
}))
vi.mock('@/components/DisclaimerBanner', () => ({
  __esModule: true,
  default: ({
    messages = []
  }: {
    messages?: Array<string | null | undefined>
  }) => (
    <div data-test="disclaimer-banner">
      {messages.filter(Boolean).map((message, i) => (
        <div key={i}>{message}</div>
      ))}
    </div>
  )
}))
vi.mock('@/components/Loading', () => ({
  __esModule: true,
  default: ({ fixed }: { fixed?: boolean }) => (
    <div data-test="loading-component">
      {fixed ? 'Fixed Loading' : 'Loading'}
    </div>
  )
}))
vi.mock('@/components/RequireAuth', () => ({
  RequireAuth: ({ children }: { children: ReactNode }) => (
    <div data-test="require-auth">{children}</div>
  )
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

const mockedUseMatches = useMatches as unknown as Mock
const mockedUseNavigate = useNavigate as unknown as Mock
const mockedUseCurrentUser = useCurrentUser as unknown as Mock
const mockedUseAuthorization = useAuthorization as unknown as Mock
const mockedUseLoadingStore = useLoadingStore as unknown as Mock
const mockedUseAuth = useAuth as unknown as Mock

describe('MainLayout', () => {
  const navigate = vi.fn()

  test.beforeEach(() => {
    // Default mock setup
    mockedUseMatches.mockReturnValue([{ handle: { title: 'Test Page Title' } }])
    mockedUseNavigate.mockReturnValue(navigate)
    mockedUseCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'gov' }],
        isGovernmentUser: true
      }
    })
    mockedUseAuthorization.mockReturnValue({
      forbidden: false
    })
    mockedUseLoadingStore.mockReturnValue(false)
    mockedUseAuth.mockReturnValue({
      refreshToken: vi.fn()
    })

    // Clear navigation mock calls
    navigate.mockClear()
  })

  test('renders the layout with all expected components', async ({
    render,
    query,
    theme,
    router
  }) => {
    render(<MainLayout />, [query, theme, router])

    expect(screen.getByTestId('require-auth')).toBeInTheDocument()
    expect(screen.getByTestId('navbar-component')).toBeInTheDocument()
    expect(screen.getByTestId('crumb-component')).toBeInTheDocument()
    expect(screen.getByTestId('outlet-content')).toBeInTheDocument()
    expect(screen.getByTestId('disclaimer-banner')).toBeInTheDocument()
    expect(screen.getByTestId('footer-component')).toBeInTheDocument()
    expect(screen.getByText('Test Page Title')).toBeInTheDocument()
  })

  test('displays the page title from route metadata', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseMatches.mockReturnValue([
      { handle: { title: 'Custom Page Title' } }
    ])

    render(<MainLayout />, [query, theme, router])

    expect(screen.getByText('Custom Page Title')).toBeInTheDocument()
  })

  test('uses default title when no title in route metadata', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseMatches.mockReturnValue([{ handle: {} }])

    render(<MainLayout />, [query, theme, router])

    expect(screen.getByText('LCFS')).toBeInTheDocument()
  })

  test('redirects to unauthorized page when forbidden is true', async ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseAuthorization.mockReturnValue({
      forbidden: true
    })

    window.history.replaceState({}, '', '/dashboard')

    render(<MainLayout />, [query, theme, router])

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(ROUTES.AUTH.UNAUTHORIZED)
    })
  })

  test('does not redirect when already on unauthorized page', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseAuthorization.mockReturnValue({
      forbidden: true
    })

    window.history.replaceState({}, '', ROUTES.AUTH.UNAUTHORIZED)

    render(<MainLayout />, [query, theme, router])

    expect(navigate).not.toHaveBeenCalled()
  })

  test('shows different disclaimer banner for government vs non-government users', ({
    render,
    query,
    theme,
    router
  }) => {
    // Test with government user
    mockedUseCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'gov' }],
        isGovernmentUser: true
      }
    })

    const { rerender } = render(<MainLayout />, [query, theme, router])
    const disclaimerBanner = screen.getByTestId('disclaimer-banner')
    expect(disclaimerBanner.children.length).toBe(1)

    // Test with non-government user
    mockedUseCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'supplier' }],
        isGovernmentUser: false
      }
    })

    rerender(<MainLayout />)

    // We should see two parts of the disclaimer for non-government users
    const disclaimerBanner2 = screen.getByTestId('disclaimer-banner')
    expect(disclaimerBanner2.children.length).toBe(2)
  })

  test('displays loading component when loading state is true', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseLoadingStore.mockImplementation(
      (selector: (state: { loading: boolean }) => boolean) => {
        // This simulates the zustand store behavior
        return selector({ loading: true })
      }
    )

    render(<MainLayout />, [query, theme, router])

    // Get loading component by text content instead
    expect(screen.getByText('Fixed Loading')).toBeInTheDocument()
  })

  test('does not display loading component when loading state is false', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseLoadingStore.mockImplementation(
      (selector: (state: { loading: boolean }) => boolean) => {
        // This simulates the zustand store behavior
        return selector({ loading: false })
      }
    )

    render(<MainLayout />, [query, theme, router])

    expect(screen.queryByTestId('loading-component')).not.toBeInTheDocument()
  })
})
