import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import TransferHistory from '../TransferHistory'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTransfer } from '@/hooks/useTransfer'
import { wrapper } from '@/tests/utils/wrapper'
import {
  TRANSFER_STATUSES,
  TRANSFER_RECOMMENDATION
} from '@/constants/statuses'
import dayjs from 'dayjs'

vi.mock('@/hooks/useTransfer')

vi.mock('react-router-dom', () => ({
  useParams: () => ({ transferId: '1' })
}))

vi.mock('react-i18next', () => {
  const translations = {
    'transfer:transferHistory.Submitted': 'Signed and submitted',
    'transfer:transferHistory.RecommendedRecord':
      'Recommended recording transfer',
    'transfer:transferHistory.RecommendedRefuse':
      'Recommended refusing transfer'
  }
  return {
    useTranslation: () => ({
      t: (key) => translations[key] || 'Status not found'
    })
  }
})

describe('TransferHistory Component', () => {
  const transferHistory = [
    {
      transferStatus: { transferStatusId: 1, status: 'Signed and submitted' },
      createDate: '2023-01-02',
      userProfile: {
        firstName: 'John',
        lastName: 'Doe',
        organization: { name: 'Org A' }
      }
    },
    {
      transferStatus: { transferStatusId: 2, status: 'Recommended' },
      createDate: '2023-01-03',
      userProfile: {
        firstName: 'Jane',
        lastName: 'Smith',
        organization: { name: 'Org B' }
      }
    }
  ]

  // Before each test, set up mocks and fix the Date object
  beforeEach(() => {
    // Mock 'useTransfer' to return consistent data
    useTransfer.mockReturnValue({
      data: {
        currentStatus: { status: TRANSFER_STATUSES.SUBMITTED },
        recommendation: 'Record',
        agreementDate: '2023-01-01',
        transferCategory: { category: 'A' }
      }
    })

    // Mock Date to return a fixed time
    const mockDate = new Date('2023-01-02T00:00:00Z')
    global.Date = class extends Date {
      constructor(...args) {
        if (args.length) {
          return super(...args)
        }
        return mockDate
      }

      static now() {
        return mockDate.getTime()
      }
    }
  })

  // After each test, restore mocks and clean up
  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
  })

  it('renders transfer history correctly', () => {
    render(<TransferHistory transferHistory={transferHistory} />, { wrapper })

    expect(
      screen.getByText(
        /Date of written agreement reached between the two organizations/
      )
    ).toBeInTheDocument()

    transferHistory.forEach((item) => {
      expect(
        screen.getByText(
          `${item.userProfile.firstName} ${item.userProfile.lastName}`
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText(item.userProfile.organization.name)
      ).toBeInTheDocument()
    })
  })

  it('renders correct status labels for different statuses and recommendations', () => {
    const statuses = [
      {
        status: TRANSFER_STATUSES.RECOMMENDED,
        recommendation: TRANSFER_RECOMMENDATION.RECORD,
        expectedLabel: 'Recommended recording transfer'
      },
      {
        status: TRANSFER_STATUSES.RECOMMENDED,
        recommendation: TRANSFER_RECOMMENDATION.REFUSE,
        expectedLabel: 'Recommended refusing transfer'
      }
    ]

    statuses.forEach(({ status, recommendation, expectedLabel }) => {
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status },
          recommendation,
          agreementDate: '2023-01-01',
          transferCategory: { category: 'A' }
        }
      })

      render(<TransferHistory transferHistory={transferHistory} />, { wrapper })

      expect(screen.getByText(expectedLabel)).toBeInTheDocument()
      cleanup() // Clean up after each iteration
    })
  })

  it('handles empty transferHistory gracefully', () => {
    render(<TransferHistory transferHistory={[]} />, { wrapper })

    const listItems = screen.queryAllByRole('listitem')
    expect(listItems).toHaveLength(1) // Only the agreement date item
  })

  it('handles undefined transferHistory gracefully', () => {
    render(<TransferHistory />, { wrapper })

    const listItems = screen.queryAllByRole('listitem')
    expect(listItems).toHaveLength(1) // Only the agreement date item
  })

  it('formats dates correctly with multiple occurrences', () => {
    render(<TransferHistory transferHistory={transferHistory} />, { wrapper })
    // Use getAllByText to handle multiple elements with the same date
    const formattedDate = dayjs(transferHistory[0].createDate).format(
      'MMMM D, YYYY'
    )
    expect(
      screen.getAllByText(new RegExp(formattedDate)).length
    ).toBeGreaterThanOrEqual(1)
  })
})
