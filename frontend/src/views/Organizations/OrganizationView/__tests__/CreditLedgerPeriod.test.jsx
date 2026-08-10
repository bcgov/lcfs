import {
  cleanup,
  render,
  screen,
  fireEvent,
  within
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

import { CreditLedgerPeriod } from '../CreditLedgerPeriod'

// t returns the key, interpolating year/type so period + assessed labels are
// assertable.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      if (opts && opts.year != null) return `${key}|${opts.year}`
      if (opts && opts.type != null) return `${key}|${opts.type}`
      return key
    }
  })
}))

// Only dateFormatter is stubbed (identity, so raw ISO strings stay assertable);
// formatTransactionId is kept real so the id prefixes are exercised for real.
vi.mock('@/utils/formatters', async (importOriginal) => ({
  ...(await importOriginal()),
  dateFormatter: ({ value }) => value
}))

vi.mock('@/hooks/useCreditLedger', () => ({
  usePeriodCreditLedger: vi.fn(),
  useDownloadPeriodCreditLedger: vi.fn(),
  useCreditLedgerYears: vi.fn()
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn()
}))

import {
  usePeriodCreditLedger,
  useDownloadPeriodCreditLedger,
  useCreditLedgerYears
} from '@/hooks/useCreditLedger'
import { useCurrentUser } from '@/hooks/useCurrentUser'

const mockPeriod = vi.mocked(usePeriodCreditLedger)
const mockYears = vi.mocked(useCreditLedgerYears)
const mockDownload = vi.mocked(useDownloadPeriodCreditLedger)
const mockCurrentUser = vi.mocked(useCurrentUser)

const PERIOD_PAYLOAD = {
  organizationId: 999,
  compliancePeriod: 2024,
  includePending: false,
  transactions: [
    {
      transactionId: 43,
      transactionType: 'InitiativeAgreement',
      description: null,
      effectiveDate: '2024-04-03',
      unitsIn: 10000,
      unitsOut: 0,
      runningBalance: 10000,
      status: 'Approved',
      isPending: false
    },
    {
      transactionId: 444,
      transactionType: 'Transfer',
      description: null,
      effectiveDate: '2025-07-08',
      unitsIn: 0,
      unitsOut: 1500,
      runningBalance: -1500,
      status: 'Recorded',
      isPending: false
    }
  ],
  totalsByType: [
    { transactionType: 'Transfer', unitsIn: 0, unitsOut: 1500, net: -1500 },
    {
      transactionType: 'InitiativeAgreement',
      unitsIn: 10000,
      unitsOut: 0,
      net: 10000
    }
  ],
  totalUnitsIn: 10000,
  totalUnitsOut: 1500,
  totalNet: 8500,
  assessedBalance: {
    previousYear: 2023,
    previousBalance: 1000,
    currentYear: 2024,
    currentBalance: 1850
  }
}

const renderComponent = (props = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CreditLedgerPeriod {...props} />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('CreditLedgerPeriod (compliance-period ledger #4714)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentUser.mockReturnValue({
      data: { organization: { organizationId: 999 } }
    })
    mockYears.mockReturnValue({ data: ['2024', '2023', '2022'] })
    mockPeriod.mockReturnValue({
      data: PERIOD_PAYLOAD,
      isLoading: false,
      isError: false
    })
    mockDownload.mockReturnValue(vi.fn())
  })
  afterEach(cleanup)

  it('defaults to the most recent available compliance period', () => {
    renderComponent({ organizationId: 999 })
    expect(screen.getByTestId('ledger-current-period')).toHaveTextContent(
      '2024'
    )
    expect(mockPeriod).toHaveBeenCalledWith(
      expect.objectContaining({ complianceYear: 2024, includePending: false })
    )
  })

  it('navigates to the previous and next compliance period', () => {
    renderComponent({ organizationId: 999 })

    fireEvent.click(screen.getByTestId('ledger-prev-period'))
    expect(screen.getByTestId('ledger-current-period')).toHaveTextContent(
      '2023'
    )
    expect(mockPeriod).toHaveBeenLastCalledWith(
      expect.objectContaining({ complianceYear: 2023 })
    )

    fireEvent.click(screen.getByTestId('ledger-next-period'))
    expect(screen.getByTestId('ledger-current-period')).toHaveTextContent(
      '2024'
    )
  })

  it('renders transaction rows with units and a running balance', () => {
    renderComponent({ organizationId: 999 })
    const balances = screen.getAllByTestId('ledger-running-balance')
    expect(balances).toHaveLength(2)
    expect(balances[0]).toHaveTextContent('10,000')
    // Negative running balance rendered (styling handled by NumberCell)
    expect(balances[1]).toHaveTextContent('-1,500')
  })

  // Regression: every non-ComplianceReport type used to fall back to the "CT"
  // transfer prefix, so initiative agreements and admin adjustments displayed
  // a correct number under the wrong prefix.
  it('prefixes transaction ids by type in both the list and totals views', () => {
    renderComponent({ organizationId: 999 })
    expect(screen.getByText('IA43')).toBeInTheDocument()
    expect(screen.getByText('CT444')).toBeInTheDocument()
    expect(screen.queryByText('CT43')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('toggle-show-totals'))
    expect(screen.getByText('IA43')).toBeInTheDocument()
    expect(screen.getByText('CT444')).toBeInTheDocument()
    expect(screen.queryByText('CT43')).not.toBeInTheDocument()
  })

  it('switches to grouped totals view with per-type and grand totals', () => {
    renderComponent({ organizationId: 999 })
    expect(screen.queryByTestId('ledger-grand-total')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('toggle-show-totals'))

    const typeTotals = screen.getAllByTestId('ledger-type-total')
    expect(typeTotals).toHaveLength(2)
    const grand = screen.getByTestId('ledger-grand-total')
    expect(within(grand).getByText('10,000')).toBeInTheDocument() // total in
    expect(within(grand).getByText('1,500')).toBeInTheDocument() // total out
    expect(within(grand).getByText('8,500')).toBeInTheDocument() // net
  })

  it('requests pending transactions when the toggle is on', () => {
    renderComponent({ organizationId: 999 })
    fireEvent.click(screen.getByTestId('toggle-show-pending'))
    expect(mockPeriod).toHaveBeenLastCalledWith(
      expect.objectContaining({ includePending: true })
    )
  })

  it('downloads the period on screen, pending toggle included', () => {
    // #4832: the export goes through the period endpoint so the spreadsheet
    // carries the same April–March envelope the table is showing.
    const download = vi.fn()
    mockDownload.mockReturnValue(download)
    renderComponent({ organizationId: 999 })

    fireEvent.click(screen.getByTestId('download-credit-ledger'))
    expect(download).toHaveBeenLastCalledWith({
      orgId: 999,
      complianceYear: 2024,
      includePending: false
    })

    fireEvent.click(screen.getByTestId('toggle-show-pending'))
    fireEvent.click(screen.getByTestId('ledger-prev-period'))
    fireEvent.click(screen.getByTestId('download-credit-ledger'))
    expect(download).toHaveBeenLastCalledWith({
      orgId: 999,
      complianceYear: 2023,
      includePending: true
    })
  })

  it('renders the assessed-balance section for previous and current year', () => {
    renderComponent({ organizationId: 999 })
    const section = screen.getByTestId('ledger-assessed-balance')
    expect(within(section).getByTestId('assessed-previous')).toHaveTextContent(
      '1,000'
    )
    expect(within(section).getByTestId('assessed-current')).toHaveTextContent(
      '1,850'
    )
  })

  it('leaves an assessed balance blank when the year has no assessed report', () => {
    // #4831: absent is not zero — a year with no assessed report has no
    // assessed balance, and showing 0 would read as a real end-of-year balance.
    mockPeriod.mockReturnValue({
      data: {
        ...PERIOD_PAYLOAD,
        assessedBalance: {
          previousYear: 2023,
          previousBalance: 1000,
          currentYear: 2024,
          currentBalance: null
        }
      },
      isLoading: false,
      isError: false
    })
    renderComponent({ organizationId: 999 })
    const section = screen.getByTestId('ledger-assessed-balance')
    expect(within(section).getByTestId('assessed-current')).toHaveTextContent(
      ''
    )
    expect(
      within(section).getByTestId('assessed-current')
    ).not.toHaveTextContent('0')
    // The year that does have an assessed report still shows its value.
    expect(within(section).getByTestId('assessed-previous')).toHaveTextContent(
      '1,000'
    )
  })

  it('shows an empty state when the period has no transactions', () => {
    mockPeriod.mockReturnValue({
      data: {
        ...PERIOD_PAYLOAD,
        transactions: [],
        totalsByType: [],
        totalUnitsIn: 0,
        totalUnitsOut: 0,
        totalNet: 0
      },
      isLoading: false,
      isError: false
    })
    renderComponent({ organizationId: 999 })
    expect(screen.getByTestId('ledger-empty')).toBeInTheDocument()
  })

  it('falls back to the current user org when no organizationId prop is given', () => {
    renderComponent()
    expect(mockPeriod).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 999 })
    )
  })
})
