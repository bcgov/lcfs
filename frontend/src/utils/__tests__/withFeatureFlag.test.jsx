import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import withFeatureFlag from '../withFeatureFlag.jsx' // Adjust the import path as necessary
import { isFeatureEnabled } from '@/constants/config'

// Mock the isFeatureEnabled function
vi.mock('@/constants/config', () => ({
  isFeatureEnabled: vi.fn()
}))

// Mock Navigate component
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  Navigate: ({ to }) => <div data-test="navigate">Navigate to {to}</div>
}))

// Define a mock component to be wrapped
const MockComponent = () => <div>Feature Enabled Content</div>

describe('withFeatureFlag HOC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the wrapped component when the feature flag is enabled', () => {
    isFeatureEnabled.mockReturnValue(true)

    const WrappedComponent = withFeatureFlag(
      MockComponent,
      'new-feature',
      '/fallback'
    )

    render(<WrappedComponent />)

    expect(screen.getByText('Feature Enabled Content')).toBeInTheDocument()
  })

  it('redirects to the specified path when the feature flag is disabled and redirect is provided', () => {
    isFeatureEnabled.mockReturnValue(false)

    const WrappedComponent = withFeatureFlag(
      MockComponent,
      'new-feature',
      '/fallback'
    )

    render(<WrappedComponent />)

    const navigateElement = screen.getByTestId('navigate')
    expect(navigateElement).toBeInTheDocument()
    expect(navigateElement).toHaveTextContent('Navigate to /fallback')
  })

  it('renders null when the feature flag is disabled and no redirect is provided', () => {
    isFeatureEnabled.mockReturnValue(false)

    const WrappedComponent = withFeatureFlag(MockComponent, 'new-feature')

    const { container } = render(<WrappedComponent />)

    expect(container.firstChild).toBeNull()
  })

  it('sets the correct display name for the wrapped component', () => {
    isFeatureEnabled.mockReturnValue(true)

    const WrappedComponent = withFeatureFlag(
      MockComponent,
      'new-feature',
      '/fallback'
    )

    render(<WrappedComponent />)

    expect(WrappedComponent.displayName).toBe('WithFeatureFlag(MockComponent)')
  })

  it('handles undefined featureFlag gracefully by rendering the wrapped component', () => {
    isFeatureEnabled.mockReturnValue(false)

    const WrappedComponent = withFeatureFlag(
      MockComponent,
      undefined,
      '/fallback'
    )

    render(<WrappedComponent />)

    const navigateElement = screen.getByTestId('navigate')
    expect(navigateElement).toBeInTheDocument()
    expect(navigateElement).toHaveTextContent('Navigate to /fallback')
  })

  it('handles null props correctly by passing them to the wrapped component', () => {
    isFeatureEnabled.mockReturnValue(true)

    const WrappedComponent = withFeatureFlag(
      MockComponent,
      'new-feature',
      '/fallback'
    )

    render(<WrappedComponent prop1={null} />)

    expect(screen.getByText('Feature Enabled Content')).toBeInTheDocument()
  })
})
