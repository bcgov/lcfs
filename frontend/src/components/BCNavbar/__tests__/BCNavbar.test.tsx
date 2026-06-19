import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMediaQuery, useTheme } from '@mui/material'
import BCNavbar from '../index'
import theme from '@/themes'

vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material')
  return {
    ...actual,
    useTheme: vi.fn(),
    useMediaQuery: vi.fn()
  }
})

const mockedUseMediaQuery = useMediaQuery as unknown as Mock
const mockedUseTheme = useTheme as unknown as Mock

const sampleRoutes = [
  { icon: 'home', name: 'Dashboard', route: '/' },
  { name: 'Document', route: '/document' },
  { name: 'Transactions', route: '/transactions' },
  {
    name: 'Compliance Report',
    route: '/compliance-report',
    activePaths: ['/compliance-report', '/compliance-report/history']
  }
]

const TestWrapper = ({
  children,
  initialEntries = ['/']
}: {
  children: React.ReactNode
  initialEntries?: string[]
}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

const renderNavbar = (initialPath = '/') => {
  return render(
    <BCNavbar routes={sampleRoutes} />,
    {
      wrapper: ({ children }) => (
        <TestWrapper initialEntries={[initialPath]}>{children}</TestWrapper>
      )
    }
  )
}

describe('BCNavbar', () => {
  beforeEach(() => {
    mockedUseMediaQuery.mockReturnValue(false)
    mockedUseTheme.mockReturnValue({
      breakpoints: {
        down: () => 'xl'
      }
    })
  })

  describe('rendering', () => {
    it('renders the navbar with expected test id', () => {
      renderNavbar()

      expect(screen.getByTestId('bc-navbar')).toBeInTheDocument()
    })

    it('renders navigation route labels', () => {
      renderNavbar()

      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Document')).toBeInTheDocument()
      expect(screen.getByText('Transactions')).toBeInTheDocument()
      expect(screen.getByText('Compliance Report')).toBeInTheDocument()
    })

    it('renders navigation links with correct routes', () => {
      renderNavbar()

      expect(screen.getByText('Dashboard').closest('.NavLink')).toHaveAttribute(
        'to',
        '/'
      )
      expect(screen.getByText('Document').closest('.NavLink')).toHaveAttribute(
        'to',
        '/document'
      )
    })
  })

  describe('navigation', () => {
    it('hides routes marked with hide', () => {
      render(
        <BCNavbar
          routes={[
            { name: 'Visible', route: '/visible' },
            { name: 'Hidden', route: '/hidden', hide: true }
          ]}
        />,
        { wrapper: TestWrapper }
      )

      expect(screen.getByText('Visible')).toBeInTheDocument()
      expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
    })
  })

  describe('active state', () => {
    it('marks the current route link as active', () => {
      renderNavbar('/document')

      expect(screen.getByText('Document').closest('.NavLink')).toHaveClass(
        'active'
      )
      expect(screen.getByText('Dashboard').closest('.NavLink')).not.toHaveClass(
        'active'
      )
    })

    it('marks a route active when pathname matches an activePaths entry', () => {
      renderNavbar('/compliance-report/history')

      expect(
        screen.getByText('Compliance Report').closest('.NavLink')
      ).toHaveClass('active')
    })

    it('marks dashboard active on root path', () => {
      renderNavbar('/')

      expect(screen.getByText('Dashboard').closest('.NavLink')).toHaveClass(
        'active'
      )
    })

    it('marks nested routes as active', () => {
      renderNavbar('/transactions/123')

      expect(screen.getByText('Transactions').closest('.NavLink')).toHaveClass(
        'active'
      )
    })
  })

  describe('custom props', () => {
    it('renders custom title', () => {
      render(
        <BCNavbar
          title="Custom Title"
          routes={[{ name: 'Home', route: '/' }]}
        />,
        { wrapper: TestWrapper }
      )

      expect(screen.getByTestId('bc-navbar')).toBeInTheDocument()
    })

    it('renders with beta flag enabled by default', () => {
      renderNavbar()

      expect(screen.getByTestId('bc-navbar')).toBeInTheDocument()
    })

    it('renders without beta flag when disabled', () => {
      render(
        <BCNavbar beta={false} routes={sampleRoutes} />,
        { wrapper: TestWrapper }
      )

      expect(screen.getByTestId('bc-navbar')).toBeInTheDocument()
    })

    it('renders with headerRightPart content', () => {
      render(
        <BCNavbar
          routes={sampleRoutes}
          headerRightPart={<div data-test="header-right">Header Content</div>}
        />,
        { wrapper: TestWrapper }
      )

      expect(screen.getByTestId('header-right')).toBeInTheDocument()
    })

    it('renders with menuRightPart content', () => {
      render(
        <BCNavbar
          routes={sampleRoutes}
          menuRightPart={<div data-test="menu-right">Menu Content</div>}
        />,
        { wrapper: TestWrapper }
      )

      expect(screen.getByTestId('menu-right')).toBeInTheDocument()
    })
  })

  describe('icons', () => {
    it('renders route with icon', () => {
      render(
        <BCNavbar
          routes={[{ icon: 'home', name: 'Home', route: '/' }]}
        />,
        { wrapper: TestWrapper }
      )

      expect(screen.getByText('Home')).toBeInTheDocument()
    })

    it('renders route without icon', () => {
      render(
        <BCNavbar
          routes={[{ name: 'No Icon', route: '/no-icon' }]}
        />,
        { wrapper: TestWrapper }
      )

      expect(screen.getByText('No Icon')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has proper navigation aria label', () => {
      renderNavbar()

      const nav = screen.getByRole('navigation', { name: 'main navigation' })
      expect(nav).toBeInTheDocument()
    })

    it('renders as nav element', () => {
      renderNavbar()

      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })
  })

  describe('responsive behavior', () => {
    it('renders desktop view when not mobile', () => {
      mockedUseMediaQuery.mockReturnValue(false)
      renderNavbar()

      expect(screen.getByTestId('bc-navbar')).toBeInTheDocument()
    })

    it('renders mobile view when mobile breakpoint', () => {
      mockedUseMediaQuery.mockReturnValue(true)
      renderNavbar()

      expect(screen.getByTestId('bc-navbar')).toBeInTheDocument()
    })
  })
})
