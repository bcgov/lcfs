import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useMatches, Outlet } from 'react-router-dom'
import PublicLayout from '../PublicLayout'
import { wrapper } from '@/tests/utils/wrapper'

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useMatches: vi.fn(),
    Outlet: vi.fn().mockReturnValue(<div data-test="outlet-content">Child Content</div>)
  }
})

describe('PublicLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children via Outlet component', () => {
    useMatches.mockReturnValue([{ handle: { title: 'Test Page' } }])
    
    render(<PublicLayout />, { wrapper })
    
    expect(screen.getByTestId('outlet-content')).toBeInTheDocument()
    expect(screen.getByText('Child Content')).toBeInTheDocument()
  })

  it('sets page title from route handle', () => {
    useMatches.mockReturnValue([{ handle: { title: 'Custom Page Title' } }])
    
    render(<PublicLayout />, { wrapper })
    
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('Custom Page Title')
  })

  it('uses default title when no handle title is provided', () => {
    useMatches.mockReturnValue([{ handle: {} }])
    
    render(<PublicLayout />, { wrapper })
    
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('LCFS')
  })

  it('uses default title when no handle exists', () => {
    useMatches.mockReturnValue([{}])
    
    render(<PublicLayout />, { wrapper })
    
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('LCFS')
  })

  it('uses default title when matches array is empty', () => {
    useMatches.mockReturnValue([])
    
    render(<PublicLayout />, { wrapper })
    
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('LCFS')
  })

  it('uses title from last match when multiple matches exist', () => {
    useMatches.mockReturnValue([
      { handle: { title: 'First Page' } },
      { handle: { title: 'Second Page' } },
      { handle: { title: 'Final Page' } }
    ])
    
    render(<PublicLayout />, { wrapper })
    
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('Final Page')
  })

  it('has visually hidden heading for accessibility', () => {
    useMatches.mockReturnValue([{ handle: { title: 'Accessible Title' } }])
    
    render(<PublicLayout />, { wrapper })
    
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveClass('visually-hidden')
    expect(heading).toHaveTextContent('Accessible Title')
  })

  it('handles undefined title gracefully', () => {
    useMatches.mockReturnValue([{ handle: { title: undefined } }])
    
    render(<PublicLayout />, { wrapper })
    
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('LCFS')
  })

  it('handles null title gracefully', () => {
    useMatches.mockReturnValue([{ handle: { title: null } }])
    
    render(<PublicLayout />, { wrapper })
    
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('LCFS')
  })

  it('handles empty string title gracefully', () => {
    useMatches.mockReturnValue([{ handle: { title: '' } }])
    
    render(<PublicLayout />, { wrapper })
    
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('LCFS')
  })

  it('calls useMatches hook correctly', () => {
    useMatches.mockReturnValue([{ handle: { title: 'Test' } }])
    
    render(<PublicLayout />, { wrapper })
    
    expect(useMatches).toHaveBeenCalledTimes(1)
  })

  it('renders Outlet component correctly', () => {
    useMatches.mockReturnValue([{ handle: { title: 'Test' } }])
    
    render(<PublicLayout />, { wrapper })
    
    expect(Outlet).toHaveBeenCalledTimes(1)
  })
})
