import { screen } from '@testing-library/react'
import { vi, describe, expect, type Mock } from 'vitest'
import { useMatches, Outlet } from 'react-router-dom'
import PublicLayout from '../PublicLayout'
import { test } from '@/tests/utils/fixtures'

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useMatches: vi.fn(),
    Outlet: vi
      .fn()
      .mockReturnValue(<div data-test="outlet-content">Child Content</div>)
  }
})

const mockedUseMatches = useMatches as unknown as Mock
const mockedOutlet = Outlet as unknown as Mock

describe('PublicLayout', () => {
  test.beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders children via Outlet component', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseMatches.mockReturnValue([{ handle: { title: 'Test Page' } }])

    render(<PublicLayout />, [query, theme, router])

    expect(screen.getByTestId('outlet-content')).toBeInTheDocument()
    expect(screen.getByText('Child Content')).toBeInTheDocument()
  })

  test('sets page title from route handle', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseMatches.mockReturnValue([
      { handle: { title: 'Custom Page Title' } }
    ])

    render(<PublicLayout />, [query, theme, router])

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('Custom Page Title')
  })

  test('uses default title when no handle title is provided', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseMatches.mockReturnValue([{ handle: {} }])

    render(<PublicLayout />, [query, theme, router])

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('LCFS')
  })

  test('uses default title when no handle exists', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseMatches.mockReturnValue([{}])

    render(<PublicLayout />, [query, theme, router])

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('LCFS')
  })

  test('uses default title when matches array is empty', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseMatches.mockReturnValue([])

    render(<PublicLayout />, [query, theme, router])

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('LCFS')
  })

  test('uses title from last match when multiple matches exist', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseMatches.mockReturnValue([
      { handle: { title: 'First Page' } },
      { handle: { title: 'Second Page' } },
      { handle: { title: 'Final Page' } }
    ])

    render(<PublicLayout />, [query, theme, router])

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('Final Page')
  })

  test('has visually hidden heading for accessibility', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseMatches.mockReturnValue([
      { handle: { title: 'Accessible Title' } }
    ])

    render(<PublicLayout />, [query, theme, router])

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveClass('visually-hidden')
    expect(heading).toHaveTextContent('Accessible Title')
  })

  test('handles undefined title gracefully', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseMatches.mockReturnValue([{ handle: { title: undefined } }])

    render(<PublicLayout />, [query, theme, router])

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('LCFS')
  })

  test('handles null title gracefully', ({ render, query, theme, router }) => {
    mockedUseMatches.mockReturnValue([{ handle: { title: null } }])

    render(<PublicLayout />, [query, theme, router])

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('LCFS')
  })

  test('handles empty string title gracefully', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseMatches.mockReturnValue([{ handle: { title: '' } }])

    render(<PublicLayout />, [query, theme, router])

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('LCFS')
  })

  test('calls useMatches hook correctly', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseMatches.mockReturnValue([{ handle: { title: 'Test' } }])

    render(<PublicLayout />, [query, theme, router])

    expect(mockedUseMatches).toHaveBeenCalledTimes(1)
  })

  test('renders Outlet component correctly', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseMatches.mockReturnValue([{ handle: { title: 'Test' } }])

    render(<PublicLayout />, [query, theme, router])

    expect(mockedOutlet).toHaveBeenCalledTimes(1)
  })
})
