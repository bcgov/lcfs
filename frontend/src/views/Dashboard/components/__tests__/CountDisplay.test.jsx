import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { test } from '@/tests/utils/fixtures'
import { CountDisplay, countDigits, MIN_COUNT_DIGITS } from '../CountDisplay'
import DirectorReviewCard from '../cards/idir/DirectorReviewCard'
import TransactionsCard from '../cards/idir/TransactionsCard'
import {
  useDirectorReviewCounts,
  useTransactionCounts
} from '@/hooks/useDashboard'

vi.mock('@/hooks/useDashboard')
vi.mock('@/utils/withRole', () => ({
  __esModule: true,
  default: (Component) => Component
}))

// Dashboard counters (#4911): links must stay in one column whatever the
// numbers beside them, and numbers must grow to the left.

describe('countDigits', () => {
  it.each([
    [1, 3],
    [10, 3],
    [99, 3],
    [100, 3],
    [999, 3],
    [1000, 4],
    [12345, 5]
  ])('sizes the column for %i as %i digits', (count, digits) => {
    expect(countDigits(count)).toBe(digits)
  })

  it('takes the longest count in the card and ignores missing ones', () => {
    expect(countDigits(4, null, 2048, undefined, 17)).toBe(4)
    expect(countDigits(null, undefined)).toBe(MIN_COUNT_DIGITS)
    expect(countDigits()).toBe(MIN_COUNT_DIGITS)
  })
})

describe('CountDisplay', () => {
  test('right-aligns the number in a column of the given width', ({
    render,
    theme
  }) => {
    render(<CountDisplay count={7} digits={4} />, [theme])

    const counter = screen.getByText('7')
    expect(counter).toHaveStyle({
      minWidth: '4ch',
      textAlign: 'right',
      flexShrink: '0',
      whiteSpace: 'nowrap'
    })
    expect(counter).not.toHaveAttribute('aria-hidden')
  })

  test('a hidden counter keeps its width but shows and announces nothing', ({
    render,
    theme
  }) => {
    const { container } = render(<CountDisplay digits={4} hidden />, [theme])

    const spacer = container.querySelector('[aria-hidden="true"]')
    expect(spacer).toHaveStyle({ minWidth: '4ch', visibility: 'hidden' })
    expect(spacer.textContent).not.toMatch(/\d/)
  })
})

describe('dashboard cards keep their links in one column', () => {
  const counterWidths = (container) =>
    [...container.querySelectorAll('.MuiTypography-h3')].map(
      (el) => window.getComputedStyle(el).minWidth
    )

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('1, 10, 99, 100 and 999 share one three-digit column', ({
    render,
    theme,
    router
  }) => {
    useDirectorReviewCounts.mockReturnValue({
      data: {
        transfers: 1,
        complianceReports: 10,
        initiativeAgreements: 99,
        adminAdjustments: 100,
        fuelCodes: 999
      },
      isLoading: false
    })

    const { container } = render(<DirectorReviewCard />, [theme, router])

    expect(counterWidths(container)).toEqual(Array(5).fill('3ch'))
    for (const value of ['1', '10', '99', '100', '999']) {
      expect(screen.getByText(value)).toHaveStyle({ textAlign: 'right' })
    }
  })

  test('a four-digit count widens the whole column, not just its row', ({
    render,
    theme,
    router
  }) => {
    useDirectorReviewCounts.mockReturnValue({
      data: {
        transfers: 1,
        complianceReports: 10,
        initiativeAgreements: 99,
        adminAdjustments: 100,
        fuelCodes: 1000
      },
      isLoading: false
    })

    const { container } = render(<DirectorReviewCard />, [theme, router])

    expect(counterWidths(container)).toEqual(Array(5).fill('4ch'))
  })

  test('a link without a count keeps an empty counter of the same width', ({
    render,
    theme,
    router
  }) => {
    useTransactionCounts.mockReturnValue({
      data: { transfers: 3, initiativeAgreements: 120, adminAdjustments: 7 },
      isLoading: false
    })

    const { container } = render(<TransactionsCard />, [theme, router])

    // Three counts and the empty counter beside "View all".
    expect(counterWidths(container)).toEqual(Array(4).fill('3ch'))
    const spacers = container.querySelectorAll(
      '.MuiTypography-h3[aria-hidden="true"]'
    )
    expect(spacers).toHaveLength(1)
    expect(spacers[0].nextSibling).toHaveTextContent(
      'dashboard:transactions.viewAllTransactions'
    )
  })
})
