import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { test } from '@/tests/utils/fixtures'
import { PublicMarketData } from '../PublicMarketData'

vi.mock('echarts-for-react', () => ({ default: () => null }))
vi.mock('html2canvas', () => ({ default: vi.fn() }), { virtual: true })
vi.mock('jspdf', () => ({ default: vi.fn() }), { virtual: true })
vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn(() => ({
      '!ref': 'A1:B2',
      A1: { v: 'Period' },
      B1: { v: 'Transfers' },
      A2: { v: 'June 2026' },
      B2: { v: 6 }
    })),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
    decode_range: vi.fn(() => ({ s: { r: 0, c: 0 }, e: { r: 1, c: 1 } })),
    encode_cell: vi.fn(({ r, c }) => `${String.fromCharCode(65 + c)}${r + 1}`)
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
  test('renders the title and KPI cards', ({ render, theme }) => {
    render(<PublicMarketData />, [theme])
    expect(
      screen.getByText('publicDashboard.marketData.title')
    ).toBeInTheDocument()
    expect(screen.getByTestId('kpi-transfers')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-volume')).toBeInTheDocument()
    expect(screen.queryByTestId('kpi-avgPrice')).not.toBeInTheDocument()
  })

  test('renders the CO2 impact band and report downloads', ({
    render,
    theme
  }) => {
    render(<PublicMarketData />, [theme])
    expect(
      screen.getByTestId('monthly-average-price-chart')
    ).toBeInTheDocument()
    expect(screen.getByTestId('transfer-price-trend-chart')).toBeInTheDocument()
    expect(screen.getByTestId('trade-volume-chart')).toBeInTheDocument()
    expect(screen.getByTestId('download-pdf')).toBeInTheDocument()
    expect(screen.getByTestId('download-all-xlsx')).toBeInTheDocument()
    expect(screen.getByTestId('download-monthly-csv')).toBeInTheDocument()
    expect(
      screen.queryByTestId('download-monthly-xlsx')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('download-quarterly-csv')).toBeInTheDocument()
    expect(
      screen.queryByTestId('download-quarterly-xlsx')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('download-annual-csv')).toBeInTheDocument()
    expect(screen.queryByTestId('download-annual-xlsx')).not.toBeInTheDocument()
  })

  test('downloads all report tables as a formatted Excel workbook', ({
    render,
    theme
  }) => {
    render(<PublicMarketData />, [theme])

    fireEvent.click(screen.getByTestId('download-all-xlsx'))

    expect(XLSX.utils.json_to_sheet).toHaveBeenCalledTimes(3)
    expect(XLSX.utils.book_append_sheet).toHaveBeenCalledTimes(3)
    expect(XLSX.writeFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(
        /^lcfs-credit-market-report-\d{4}-\d{2}-\d{2}\.xlsx$/
      ),
      { bookType: 'xlsx' }
    )

    const firstWorksheet = vi.mocked(XLSX.utils.book_append_sheet).mock
      .calls[0][1]
    expect(firstWorksheet).toMatchObject({
      '!autofilter': { ref: 'A1:B2' },
      '!cols': expect.any(Array)
    })
  })
})
