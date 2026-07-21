import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import { LegacyPublicDashboard } from '../LegacyPublicDashboard'

describe('LegacyPublicDashboard', () => {
  it('renders the public tools nav card', () => {
    render(<LegacyPublicDashboard />, { wrapper })

    expect(screen.getByTestId('legacy-public-dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('public-dashboard-card')).toBeInTheDocument()
  })

  it('links to the compliance unit calculator, calculation data, and approved carbon intensities pages', () => {
    render(<LegacyPublicDashboard />, { wrapper })

    expect(
      screen.getByTestId('public-link-credit-calculator')
    ).toHaveAttribute('href', '/credit-calculator')
    expect(
      screen.getByTestId('public-link-calculation-data')
    ).toHaveAttribute('href', '/calculation-data')
    expect(
      screen.getByTestId('public-link-approved-carbon-intensities')
    ).toHaveAttribute('href', '/approved-carbon-intensities')
  })
})
