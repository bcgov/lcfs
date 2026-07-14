import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import { PublicDashboard } from '../PublicDashboard'

const loginMock = vi.fn()

vi.mock('echarts-for-react', () => ({ default: () => null }))

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({ keycloak: { login: loginMock } })
}))

const mockData = {
  interval: 'quarter',
  latestVwap: 395,
  totalVolumeTraded: 1420000,
  outstandingCredits: 6800000,
  participatingOrganizations: 180,
  totalCreditsIssued: 9200000,
  priceIndex: [
    { period: '2024-Q1', vwap: 360, low: 335, high: 388, volume: 500000 },
    { period: '2024-Q2', vwap: 395, low: 372, high: 420, volume: 620000 }
  ]
}

vi.mock('@/hooks/useCreditMarket', () => ({
  useCreditMarketPublicOverview: () => ({ data: mockData })
}))

vi.mock('@/hooks/useLoginBgImage', () => ({
  useActiveLoginBgImage: () => ({ data: undefined })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('PublicDashboard', () => {
  it('renders the hero and program title', () => {
    render(<PublicDashboard />, { wrapper })
    expect(screen.getByText('publicDashboard.hero.title')).toBeInTheDocument()
    expect(screen.getByText('publicDashboard.cardTitle')).toBeInTheDocument()
  })

  it('renders the public tool tiles', () => {
    render(<PublicDashboard />, { wrapper })
    expect(screen.getByTestId('tool-calculator')).toBeInTheDocument()
    expect(screen.getByTestId('tool-calculationData')).toBeInTheDocument()
    expect(
      screen.getByTestId('tool-approvedCarbonIntensities')
    ).toBeInTheDocument()
  })

  it('renders tool tiles as accessible links to their routes', () => {
    render(<PublicDashboard />, { wrapper })
    expect(screen.getByTestId('tool-calculator')).toHaveAttribute(
      'href',
      '/credit-calculator'
    )
  })

  it('links to the BC Gov legislation and requirements pages', () => {
    render(<PublicDashboard />, { wrapper })
    const links = screen.getAllByTestId('legislation-link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute(
      'href',
      expect.stringContaining('renewable-low-carbon-fuels')
    )
    expect(links[1]).toHaveAttribute(
      'href',
      expect.stringContaining('/requirements')
    )
  })

  it('triggers keycloak login from the login buttons', () => {
    render(<PublicDashboard />, { wrapper })
    fireEvent.click(screen.getAllByTestId('public-login-bceid')[0])
    expect(loginMock).toHaveBeenCalledWith(
      expect.objectContaining({ idpHint: 'bceidbusiness' })
    )
  })
})
