import { screen } from '@testing-library/react'
import { describe, expect } from 'vitest'
import { test } from '@/tests/utils/fixtures'
import { LegacyPublicDashboard } from '../LegacyPublicDashboard'

describe('LegacyPublicDashboard', () => {
  test('renders the public tools nav card', ({
    render,
    router,
    theme,
    i18n
  }) => {
    render(<LegacyPublicDashboard />, [router, theme, i18n])

    expect(screen.getByTestId('legacy-public-dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('public-dashboard-card')).toBeInTheDocument()
  })

  test('links to the compliance unit calculator, calculation data, and approved carbon intensities pages', ({
    render,
    router,
    theme,
    i18n
  }) => {
    render(<LegacyPublicDashboard />, [router, theme, i18n])

    expect(screen.getByTestId('public-link-credit-calculator')).toHaveAttribute(
      'href',
      '/credit-calculator'
    )
    expect(screen.getByTestId('public-link-calculation-data')).toHaveAttribute(
      'href',
      '/calculation-data'
    )
    expect(
      screen.getByTestId('public-link-approved-carbon-intensities')
    ).toHaveAttribute('href', '/approved-carbon-intensities')
  })
})
