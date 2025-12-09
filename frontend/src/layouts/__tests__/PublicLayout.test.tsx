import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest'
import { useMatches, Outlet } from 'react-router-dom'
import PublicLayout from '../PublicLayout'
import { wrapper } from '@/tests/utils/wrapper'

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children via Outlet component', () => {
    mockedUseMatches.mockReturnValue([{ handle: { title: 'Test Page' } }])

    render(<PublicLayout />, { wrapper })

    expect(screen.getByTestId('outlet-content')).toBeInTheDocument()
    expect(screen.getByText('Child Content')).toBeInTheDocument()
  })

  it('sets page title from route handle', () => {
    mockedUseMatches.mockReturnValue([
      { handle: { title: 'Custom Page Title' } }
    ])

    render(<PublicLayout />, { wrapper })

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('Custom Page Title')
  })

  it('uses default title when no handle title is provided', () => {
    mockedUseMatches.mockReturnValue([{ handle: {} }])

    render(<PublicLayout />, { wrapper })

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('LCFS')
  })

  it('uses default title when no handle exists', () => {
    mockedUseMatches.mockReturnValue([{}])

    render(<PublicLayout />, { wrapper })

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('LCFS')
  })

  it('uses default title when matches array is empty', () => {
    mockedUseMatches.mockReturnValue([])

    render(<PublicLayout />, { wrapper })

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('LCFS')
  })

  it('uses title from last match when multiple matches exist', () => {
    mockedUseMatches.mockReturnValue([
      { handle: { title: 'First Page' } },
      { handle: { title: 'Second Page' } },
      { handle: { title: 'Final Page' } }
    ])

    render(<PublicLayout />, { wrapper })

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('Final Page')
  })

  it('has visually hidden heading for accessibility', () => {
    mockedUseMatches.mockReturnValue([
      { handle: { title: 'Accessible Title' } }
    ])

    render(<PublicLayout />, { wrapper })

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveClass('visually-hidden')
    expect(heading).toHaveTextContent('Accessible Title')
  })

  it('handles undefined title gracefully', () => {
    mockedUseMatches.mockReturnValue([{ handle: { title: undefined } }])

    render(<PublicLayout />, { wrapper })

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('LCFS')
  })

  it('handles null title gracefully', () => {
    mockedUseMatches.mockReturnValue([{ handle: { title: null } }])

    render(<PublicLayout />, { wrapper })

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('LCFS')
  })

  it('handles empty string title gracefully', () => {
    mockedUseMatches.mockReturnValue([{ handle: { title: '' } }])

    render(<PublicLayout />, { wrapper })

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('LCFS')
  })

  it('calls useMatches hook correctly', () => {
    mockedUseMatches.mockReturnValue([{ handle: { title: 'Test' } }])

    render(<PublicLayout />, { wrapper })

    expect(mockedUseMatches).toHaveBeenCalledTimes(1)
  })

  it('renders Outlet component correctly', () => {
    mockedUseMatches.mockReturnValue([{ handle: { title: 'Test' } }])

    render(<PublicLayout />, { wrapper })

    expect(mockedOutlet).toHaveBeenCalledTimes(1)
  })
})
