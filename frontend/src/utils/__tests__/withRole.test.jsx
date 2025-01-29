import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import withRole from '../withRole.jsx'
import { useCurrentUser } from '@/hooks/useCurrentUser'

// Mock the useCurrentUser hook
vi.mock('@/hooks/useCurrentUser')

// Mock Navigate component
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  Navigate: ({ to }) => <div data-test="navigate">Navigate to {to}</div>
}))

// Define a mock component to be wrapped
const MockComponent = () => <div>Protected Content</div>

describe('withRole HOC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Loading... when currentUser is undefined', () => {
    useCurrentUser.mockReturnValue({
      data: undefined
    })

    const WrappedComponent = withRole(
      MockComponent,
      ['admin', 'user'],
      '/login'
    )

    render(<WrappedComponent />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders the wrapped component when user has an allowed role', () => {
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'user' }, { name: 'editor' }]
      }
    })

    const WrappedComponent = withRole(
      MockComponent,
      ['admin', 'user'],
      '/login'
    )

    render(<WrappedComponent />)

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('redirects to the specified path when user does not have an allowed role and redirect is provided', () => {
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'guest' }]
      }
    })

    const WrappedComponent = withRole(
      MockComponent,
      ['admin', 'user'],
      '/login'
    )

    render(<WrappedComponent />)

    const navigateElement = screen.getByTestId('navigate')
    expect(navigateElement).toBeInTheDocument()
    expect(navigateElement).toHaveTextContent('Navigate to /login')
  })

  it('renders null when user does not have an allowed role and no redirect is provided', () => {
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'guest' }]
      }
    })

    const WrappedComponent = withRole(MockComponent, ['admin', 'user'])

    const { container } = render(<WrappedComponent />)

    expect(container.firstChild).toBeNull()
  })

  it('sets the correct display name for the wrapped component', () => {
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'admin' }]
      }
    })

    const WrappedComponent = withRole(MockComponent, ['admin'], '/login')

    render(<WrappedComponent />)

    expect(WrappedComponent.displayName).toBe('WithRole(MockComponent)')
  })

  it('handles currentUser with no roles gracefully', () => {
    useCurrentUser.mockReturnValue({
      data: {
        roles: []
      }
    })

    const WrappedComponent = withRole(MockComponent, ['admin'], '/login')

    render(<WrappedComponent />)

    const navigateElement = screen.getByTestId('navigate')
    expect(navigateElement).toBeInTheDocument()
    expect(navigateElement).toHaveTextContent('Navigate to /login')
  })

  it('handles currentUser.roles being undefined gracefully', () => {
    useCurrentUser.mockReturnValue({
      data: {
        // roles is undefined
      }
    })

    const WrappedComponent = withRole(MockComponent, ['admin'], '/login')

    render(<WrappedComponent />)

    const navigateElement = screen.getByTestId('navigate')
    expect(navigateElement).toBeInTheDocument()
    expect(navigateElement).toHaveTextContent('Navigate to /login')
  })
})
