import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import { PublicMarketData } from '../PublicMarketData'

vi.mock('echarts-for-react', () => ({ default: () => null }))

const mockReport = {
  monthly: [
    {
      period: '2026-06',
      transfers: 6,
      volume: 75491,
      weightedAvgPrice: 143.32,
      transferValue: 10000000
    }
  ],
  quarterly: [
    {
      period: '2026-Q2',
      transfers: 25,
      volume: 302359,
      weightedAvgPrice: 139.86,
      transferValue: 40000000
    }
  ],
  annual: [
    {
      period: '2026',
      transfers: 94,
      volume: 845918,
      weightedAvgPrice: 152.94,
      transferValue: 129371924
    }
  ],
  allTime: {
    transfers: 863,
    volume: 7825651,
    weightedAvgPrice: 335.59,
    transferValue: 2626213370
  },
  kpis: {
    labelPeriod: '2026-06',
    transfers: { current: 6, prior: null, deltaPct: null },
    volume: { current: 75491, prior: null, deltaPct: null },
    weightedAvgPrice: { current: 143.32, prior: null, deltaPct: null }
  },
  minTransfers: 5,
  minParticipants: 3
}

vi.mock('@/hooks/useCreditMarket', () => ({
  useCreditMarketPublicReport: () => ({ data: mockReport, isLoading: false }),
  useCreditMarketPublicOverview: () => ({
    data: { totalCreditsIssued: 20000000 }
  })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('PublicMarketData', () => {
  it('renders the title and KPI cards', () => {
    render(<PublicMarketData />, { wrapper })
    expect(
      screen.getByText('publicDashboard.marketData.title')
    ).toBeInTheDocument()
    expect(screen.getByTestId('kpi-transfers')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-volume')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-avgPrice')).toBeInTheDocument()
  })

  it('renders the CO2 impact band and CSV download', () => {
    render(<PublicMarketData />, { wrapper })
    expect(screen.getByTestId('impact-callout')).toBeInTheDocument()
    expect(screen.getByTestId('download-csv')).toBeInTheDocument()
  })
})
