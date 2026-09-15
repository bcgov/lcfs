import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import { PublicMarketData } from '../PublicMarketData'

vi.mock('echarts-for-react', () => ({ default: () => null }))
vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn(),
    book_new: vi.fn(),
    book_append_sheet: vi.fn()
  },
  writeFile: vi.fn()
}))

const mockReport = {
  monthly: [
    {
      period: '2026-06',
      transfers: 6,
      volume: 75491,
      weightedAvgPrice: 143.32,
      minPrice: 120,
      maxPrice: 160,
      transferValue: 10000000
    }
  ],
  a1Monthly: [
    {
      period: '2026-06',
      transfers: 5,
      volume: 30000,
      weightedAvgPrice: 141.75,
      minPrice: 120.3,
      maxPrice: 155,
      transferValue: 4252500
    }
  ],
  quarterly: [
    {
      period: '2026-Q2',
      transfers: 25,
      volume: 302359,
      weightedAvgPrice: 139.86,
      minPrice: 110,
      maxPrice: 170,
      transferValue: 40000000
    }
  ],
  annual: [
    {
      period: '2026',
      transfers: 94,
      volume: 845918,
      weightedAvgPrice: 152.94,
      minPrice: 100,
      maxPrice: 180,
      transferValue: 129371924
    }
  ],
  allTime: {
    transfers: 863,
    volume: 7825651,
    weightedAvgPrice: 335.59,
    minPrice: 20,
    maxPrice: 519.19,
    transferValue: 2626213370
  },
  kpis: {
    labelPeriod: '2026-06',
    transfers: { current: 6, prior: null, deltaPct: null },
    volume: { current: 75491, prior: null, deltaPct: null },
    weightedAvgPrice: { current: 143.32, prior: null, deltaPct: null }
  },
  ytdKpis: {
    labelPeriod: '2026-06',
    transfers: { current: 102, prior: 75, deltaPct: 36 },
    volume: { current: 896636, prior: 915869, deltaPct: -2.1 },
    weightedAvgPrice: { current: 143.32, prior: 152.94, deltaPct: -6.28 }
  },
  a1Kpis: {
    labelPeriod: '2026-06',
    transfers: { current: 5, prior: null, deltaPct: null },
    volume: { current: 30000, prior: null, deltaPct: null },
    weightedAvgPrice: { current: 141.75, prior: 120.3, deltaPct: 17.83 }
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
    expect(screen.queryByTestId('kpi-avgPrice')).not.toBeInTheDocument()
  })

  it('renders the CO2 impact band and report downloads', () => {
    render(<PublicMarketData />, { wrapper })
    expect(screen.getByTestId('annual-average-price-chart')).toBeInTheDocument()
    expect(screen.getByTestId('transfer-price-trend-chart')).toBeInTheDocument()
    expect(screen.getByTestId('trade-volume-chart')).toBeInTheDocument()
    expect(screen.getByTestId('download-pdf')).toBeInTheDocument()
    expect(screen.queryByTestId('download-monthly-csv')).not.toBeInTheDocument()
    expect(screen.getByTestId('download-monthly-xlsx')).toBeInTheDocument()
    expect(
      screen.queryByTestId('download-quarterly-csv')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('download-quarterly-xlsx')).toBeInTheDocument()
    expect(screen.queryByTestId('download-annual-csv')).not.toBeInTheDocument()
    expect(screen.getByTestId('download-annual-xlsx')).toBeInTheDocument()
  })
})
