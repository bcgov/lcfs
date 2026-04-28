import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import { PublicDashboard } from '../PublicDashboard'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'publicDashboard.cardTitle': 'LCFS program information',
        'publicDashboard.links.calculator': 'Compliance unit calculator',
        'publicDashboard.links.calculationData': 'Calculation data',
        'publicDashboard.links.approvedCarbonIntensities':
          'Approved carbon intensities'
      }
      return translations[key] ?? key
    }
  })
}))

describe('PublicDashboard', () => {
  it('renders the card title', () => {
    render(<PublicDashboard />, { wrapper })

    expect(screen.getByText('LCFS program information')).toBeInTheDocument()
  })

  it('renders all three navigation links', () => {
    render(<PublicDashboard />, { wrapper })

    expect(screen.getByText('Compliance unit calculator')).toBeInTheDocument()
    expect(screen.getByText('Calculation data')).toBeInTheDocument()
    expect(screen.getByText('Approved carbon intensities')).toBeInTheDocument()
  })

  it('renders links with correct href attributes', () => {
    render(<PublicDashboard />, { wrapper })

    expect(
      screen.getByTestId('public-link-credit-calculator').closest('a')
    ).toHaveAttribute('href', '/credit-calculator')
    expect(
      screen.getByTestId('public-link-calculation-data').closest('a')
    ).toHaveAttribute('href', '/calculation-data')
    expect(
      screen.getByTestId('public-link-approved-carbon-intensities').closest('a')
    ).toHaveAttribute('href', '/approved-carbon-intensities')
  })

  it('renders link elements for accessibility', () => {
    render(<PublicDashboard />, { wrapper })

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(3)
  })
})
