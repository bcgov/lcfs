import React from 'react'
import { screen, cleanup } from '@testing-library/react'
import TransferHistory from '../TransferHistory'
import { beforeEach, describe, expect, vi } from 'vitest'
import { useTransfer } from '@/hooks/useTransfer'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { test } from '@/tests/utils/fixtures'
import {
  TRANSFER_STATUSES,
  TRANSFER_RECOMMENDATION
} from '@/constants/statuses'
import dayjs from 'dayjs'

vi.mock('@/hooks/useTransfer')
vi.mock('@/hooks/useCurrentUser')

vi.mock('react-router-dom', () => ({
  useParams: () => ({ transferId: '1' })
}))

vi.mock('react-i18next', () => {
  const translations = {
    'transfer:transferHistory.Submitted': 'Signed and submitted',
    'transfer:transferHistory.Sent': 'Sent for review',
    'transfer:transferHistory.Recorded': 'Recorded',
    'transfer:transferHistory.RecommendedRecord':
      'Recommended recording transfer',
    'transfer:transferHistory.RecommendedRefuse':
      'Recommended refusing transfer',
    'transfer:txnHistory': 'Transaction History',
    'transfer:director': 'Director',
    underAct: 'Low Carbon Fuel Standard Act',
    govOrg: 'Government of BC'
  }
  return {
    useTranslation: () => ({
      t: (key, defaultValue = key) =>
        translations[key] || defaultValue || 'Status not found'
    })
  }
})

vi.mock('@/utils/formatters', () => ({
  formatDateWithTimezoneAbbr: (date) => `Formatted: ${date}`
}))

describe('TransferHistory Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Early return conditions', () => {
    test('returns null when transferData is null', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useTransfer.mockReturnValue({ data: null })
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: true } })

      const { container } = render(<TransferHistory transferHistory={[]} />, [
        query,
        theme,
        localization,
        router
      ])
      expect(container.firstChild).toBeNull()
    })

    test('returns null when transferData is undefined', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useTransfer.mockReturnValue({ data: undefined })
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: true } })

      const { container } = render(<TransferHistory transferHistory={[]} />, [
        query,
        theme,
        localization,
        router
      ])
      expect(container.firstChild).toBeNull()
    })

    test('returns null when useTransfer returns undefined', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useTransfer.mockReturnValue({})
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: true } })

      const { container } = render(<TransferHistory transferHistory={[]} />, [
        query,
        theme,
        localization,
        router
      ])
      expect(container.firstChild).toBeNull()
    })
  })

  describe('getTransferStatusLabel function', () => {
    const mockTransferData = {
      currentStatus: { status: TRANSFER_STATUSES.SUBMITTED },
      recommendation: TRANSFER_RECOMMENDATION.RECORD,
      agreementDate: '2023-01-01'
    }

    beforeEach(() => {
      useTransfer.mockReturnValue({ data: mockTransferData })
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: true } })
    })

    test('handles RECOMMENDED status with RECORD recommendation', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const history = [
        {
          transferStatus: {
            transferStatusId: 1,
            status: TRANSFER_STATUSES.RECOMMENDED
          },
          createDate: '2023-01-02',
          userProfile: {
            firstName: 'John',
            lastName: 'Doe',
            organization: { name: 'Org A' }
          }
        }
      ]

      useTransfer.mockReturnValue({
        data: {
          ...mockTransferData,
          recommendation: TRANSFER_RECOMMENDATION.RECORD
        }
      })

      render(<TransferHistory transferHistory={history} />, [
        query,
        theme,
        localization,
        router
      ])
      expect(
        screen.getByText('Recommended recording transfer')
      ).toBeInTheDocument()
    })

    test('handles RECOMMENDED status with REFUSE recommendation', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const history = [
        {
          transferStatus: {
            transferStatusId: 1,
            status: TRANSFER_STATUSES.RECOMMENDED
          },
          createDate: '2023-01-02',
          userProfile: {
            firstName: 'John',
            lastName: 'Doe',
            organization: { name: 'Org A' }
          }
        }
      ]

      useTransfer.mockReturnValue({
        data: {
          ...mockTransferData,
          recommendation: TRANSFER_RECOMMENDATION.REFUSE
        }
      })

      render(<TransferHistory transferHistory={history} />, [
        query,
        theme,
        localization,
        router
      ])
      expect(
        screen.getByText('Recommended refusing transfer')
      ).toBeInTheDocument()
    })

    test('handles non-RECOMMENDED status', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const history = [
        {
          transferStatus: {
            transferStatusId: 1,
            status: TRANSFER_STATUSES.SUBMITTED
          },
          createDate: '2023-01-02',
          userProfile: {
            firstName: 'John',
            lastName: 'Doe',
            organization: { name: 'Org A' }
          }
        }
      ]

      render(<TransferHistory transferHistory={history} />, [
        query,
        theme,
        localization,
        router
      ])
      expect(screen.getByText('Signed and submitted')).toBeInTheDocument()
    })

    test('handles unknown status', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const history = [
        {
          transferStatus: { transferStatusId: 1, status: 'UNKNOWN_STATUS' },
          createDate: '2023-01-02',
          userProfile: {
            firstName: 'John',
            lastName: 'Doe',
            organization: { name: 'Org A' }
          }
        }
      ]

      render(<TransferHistory transferHistory={history} />, [
        query,
        theme,
        localization,
        router
      ])
      expect(screen.getByText('Status not found')).toBeInTheDocument()
    })
  })

  describe('Category calculation logic', () => {
    test('uses transferCategory when provided', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: TRANSFER_STATUSES.SUBMITTED },
          agreementDate: '2023-01-01',
          transferCategory: { category: 'B' }
        }
      })
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: true } })

      render(<TransferHistory transferHistory={[]} />, [
        query,
        theme,
        localization,
        router
      ])
      expect(screen.getByText(/Category B/)).toBeInTheDocument()
    })

    test('displays A1 when the A1 category flag is set', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: TRANSFER_STATUSES.RECORDED },
          agreementDate: '2023-01-01',
          transferCategory: { category: 'A' },
          isA1Category: true
        }
      })
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: true } })

      render(<TransferHistory transferHistory={[]} />, [
        query,
        theme,
        localization,
        router
      ])
      expect(screen.getByText(/Category A1/)).toBeInTheDocument()
    })

    test('defaults to calculated category when transferCategory not provided', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: TRANSFER_STATUSES.SUBMITTED },
          agreementDate: '2023-01-01'
        }
      })
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: true } })

      render(<TransferHistory transferHistory={[]} />, [
        query,
        theme,
        localization,
        router
      ])
      expect(screen.getByText(/Category/)).toBeInTheDocument()
    })
  })

  describe('DRAFT record filtering', () => {
    const mockTransferData = {
      currentStatus: { status: TRANSFER_STATUSES.SUBMITTED },
      agreementDate: '2023-01-01'
    }

    beforeEach(() => {
      useTransfer.mockReturnValue({ data: mockTransferData })
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: true } })
    })

    test('filters out DRAFT records', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const history = [
        {
          transferStatus: {
            transferStatusId: 1,
            status: TRANSFER_STATUSES.DRAFT
          },
          createDate: '2023-01-01',
          userProfile: {
            firstName: 'Draft',
            lastName: 'User',
            organization: { name: 'Draft Org' }
          }
        },
        {
          transferStatus: {
            transferStatusId: 2,
            status: TRANSFER_STATUSES.SUBMITTED
          },
          createDate: '2023-01-02',
          userProfile: {
            firstName: 'John',
            lastName: 'Doe',
            organization: { name: 'Org A' }
          }
        }
      ]

      render(<TransferHistory transferHistory={history} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(screen.queryByText('Draft User')).not.toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    test('handles empty history after filtering', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const history = [
        {
          transferStatus: {
            transferStatusId: 1,
            status: TRANSFER_STATUSES.DRAFT
          },
          createDate: '2023-01-01',
          userProfile: {
            firstName: 'Draft',
            lastName: 'User',
            organization: { name: 'Draft Org' }
          }
        }
      ]

      render(<TransferHistory transferHistory={history} />, [
        query,
        theme,
        localization,
        router
      ])

      const listItems = screen.queryAllByRole('listitem')
      expect(listItems).toHaveLength(1) // Only agreement date item
    })

    test('handles undefined transferHistory', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<TransferHistory />, [query, theme, localization, router])

      const listItems = screen.queryAllByRole('listitem')
      expect(listItems).toHaveLength(1) // Only agreement date item
    })
  })

  describe('User type rendering differences', () => {
    const mockTransferData = {
      currentStatus: { status: TRANSFER_STATUSES.SUBMITTED },
      agreementDate: '2023-01-01'
    }

    const recordedHistory = [
      {
        transferStatus: {
          transferStatusId: 1,
          status: TRANSFER_STATUSES.RECORDED
        },
        createDate: '2023-01-02',
        displayName: 'System User',
        userProfile: {
          firstName: 'John',
          lastName: 'Doe',
          organization: { name: 'Org A' }
        }
      }
    ]

    beforeEach(() => {
      useTransfer.mockReturnValue({ data: mockTransferData })
    })

    test('shows director text for RECORDED status when user is not government', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: false } })

      render(<TransferHistory transferHistory={recordedHistory} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(screen.getByText('Director')).toBeInTheDocument()
      expect(
        screen.getByText('Low Carbon Fuel Standard Act')
      ).toBeInTheDocument()
    })

    test('shows user details for RECORDED status when user is government', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: true } })

      render(<TransferHistory transferHistory={recordedHistory} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(screen.getByText('System User')).toBeInTheDocument()
      expect(screen.getByText('Org A')).toBeInTheDocument()
    })

    test('shows user details for non-RECORDED status regardless of user type', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const nonRecordedHistory = [
        {
          transferStatus: {
            transferStatusId: 1,
            status: TRANSFER_STATUSES.SUBMITTED
          },
          createDate: '2023-01-02',
          userProfile: {
            firstName: 'John',
            lastName: 'Doe',
            organization: { name: 'Org A' }
          }
        }
      ]

      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: false } })

      render(<TransferHistory transferHistory={nonRecordedHistory} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Org A')).toBeInTheDocument()
    })
  })

  describe('Agreement date display', () => {
    const mockTransferData = {
      currentStatus: { status: TRANSFER_STATUSES.SUBMITTED },
      agreementDate: '2023-01-01'
    }

    beforeEach(() => {
      useTransfer.mockReturnValue({ data: mockTransferData })
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: true } })
    })

    test('displays agreement date for qualifying statuses', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const qualifyingStatuses = [
        TRANSFER_STATUSES.SENT,
        TRANSFER_STATUSES.SUBMITTED,
        TRANSFER_STATUSES.RECOMMENDED,
        TRANSFER_STATUSES.RECORDED
      ]

      qualifyingStatuses.forEach((status) => {
        useTransfer.mockReturnValue({
          data: { ...mockTransferData, currentStatus: { status } }
        })

        render(<TransferHistory transferHistory={[]} />, [
          query,
          theme,
          localization,
          router
        ])
        expect(
          screen.getByText(/Date of written agreement/)
        ).toBeInTheDocument()
        cleanup()
      })
    })

    test('does not display agreement date for non-qualifying statuses', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useTransfer.mockReturnValue({
        data: {
          ...mockTransferData,
          currentStatus: { status: TRANSFER_STATUSES.DRAFT }
        }
      })

      render(<TransferHistory transferHistory={[]} />, [
        query,
        theme,
        localization,
        router
      ])
      expect(
        screen.queryByText(/Date of written agreement/)
      ).not.toBeInTheDocument()
    })

    test('does not display agreement date when agreementDate is null', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useTransfer.mockReturnValue({
        data: { ...mockTransferData, agreementDate: null }
      })

      render(<TransferHistory transferHistory={[]} />, [
        query,
        theme,
        localization,
        router
      ])
      expect(
        screen.queryByText(/Date of written agreement/)
      ).not.toBeInTheDocument()
    })
  })

  describe('History item rendering', () => {
    const mockTransferData = {
      currentStatus: { status: TRANSFER_STATUSES.SUBMITTED },
      agreementDate: '2023-01-01'
    }

    beforeEach(() => {
      useTransfer.mockReturnValue({ data: mockTransferData })
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: true } })
    })

    test('renders history items with user profile names', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const history = [
        {
          transferStatus: {
            transferStatusId: 1,
            status: TRANSFER_STATUSES.SUBMITTED
          },
          createDate: '2023-01-02',
          userProfile: {
            firstName: 'John',
            lastName: 'Doe',
            organization: { name: 'Org A' }
          }
        }
      ]

      render(<TransferHistory transferHistory={history} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Org A')).toBeInTheDocument()
    })

    test('renders history items with displayName when available', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const history = [
        {
          transferStatus: {
            transferStatusId: 1,
            status: TRANSFER_STATUSES.SUBMITTED
          },
          createDate: '2023-01-02',
          displayName: 'Custom Display Name',
          userProfile: {
            firstName: 'John',
            lastName: 'Doe',
            organization: { name: 'Org A' }
          }
        }
      ]

      render(<TransferHistory transferHistory={history} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(screen.getByText('Custom Display Name')).toBeInTheDocument()
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
    })

    test('handles missing organization gracefully', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const history = [
        {
          transferStatus: {
            transferStatusId: 1,
            status: TRANSFER_STATUSES.SUBMITTED
          },
          createDate: '2023-01-02',
          userProfile: { firstName: 'John', lastName: 'Doe' }
        }
      ]

      render(<TransferHistory transferHistory={history} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Government of BC')).toBeInTheDocument()
    })

    test('formats dates correctly', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const history = [
        {
          transferStatus: {
            transferStatusId: 1,
            status: TRANSFER_STATUSES.SUBMITTED
          },
          createDate: '2023-01-02T10:30:00Z',
          userProfile: {
            firstName: 'John',
            lastName: 'Doe',
            organization: { name: 'Org A' }
          }
        }
      ]

      render(<TransferHistory transferHistory={history} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(
        screen.getByText('Formatted: 2023-01-02T10:30:00Z')
      ).toBeInTheDocument()
    })
  })

  describe('Component structure', () => {
    const mockTransferData = {
      currentStatus: { status: TRANSFER_STATUSES.SUBMITTED },
      agreementDate: '2023-01-01'
    }

    beforeEach(() => {
      useTransfer.mockReturnValue({ data: mockTransferData })
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: true } })
    })

    test('renders main container with data-test attribute', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<TransferHistory transferHistory={[]} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(screen.getByTestId('transfer-history')).toBeInTheDocument()
    })

    test('renders transaction history title', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<TransferHistory transferHistory={[]} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(screen.getByText('Transaction History')).toBeInTheDocument()
    })

    test('renders list structure', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const history = [
        {
          transferStatus: {
            transferStatusId: 1,
            status: TRANSFER_STATUSES.SUBMITTED
          },
          createDate: '2023-01-02',
          userProfile: {
            firstName: 'John',
            lastName: 'Doe',
            organization: { name: 'Org A' }
          }
        }
      ]

      render(<TransferHistory transferHistory={history} />, [
        query,
        theme,
        localization,
        router
      ])

      const list = screen.getByRole('list')
      expect(list).toBeInTheDocument()

      const listItems = screen.getAllByRole('listitem')
      expect(listItems).toHaveLength(2) // Agreement date + history item
    })
  })
})
