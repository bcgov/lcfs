import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import TransferHistory from '../TransferHistory'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTransfer } from '@/hooks/useTransfer'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { wrapper } from '@/tests/utils/wrapper'
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
    'transfer:transferHistory.RecommendedRecord': 'Recommended recording transfer',
    'transfer:transferHistory.RecommendedRefuse': 'Recommended refusing transfer',
    'transfer:txnHistory': 'Transaction History',
    'transfer:director': 'Director',
    'underAct': 'Low Carbon Fuel Standard Act',
    'govOrg': 'Government of BC'
  }
  return {
    useTranslation: () => ({
      t: (key, defaultValue = key) => translations[key] || defaultValue || 'Status not found'
    })
  }
})

vi.mock('@/utils/formatters.js', () => ({
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
    it('returns null when transferData is null', () => {
      useTransfer.mockReturnValue({ data: null })
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: true } })

      const { container } = render(<TransferHistory transferHistory={[]} />, { wrapper })
      expect(container.firstChild).toBeNull()
    })

    it('returns null when transferData is undefined', () => {
      useTransfer.mockReturnValue({ data: undefined })
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: true } })

      const { container } = render(<TransferHistory transferHistory={[]} />, { wrapper })
      expect(container.firstChild).toBeNull()
    })

    it('returns null when useTransfer returns undefined', () => {
      useTransfer.mockReturnValue({})
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: true } })

      const { container } = render(<TransferHistory transferHistory={[]} />, { wrapper })
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

    it('handles RECOMMENDED status with RECORD recommendation', () => {
      const history = [{
        transferStatus: { transferStatusId: 1, status: TRANSFER_STATUSES.RECOMMENDED },
        createDate: '2023-01-02',
        userProfile: { firstName: 'John', lastName: 'Doe', organization: { name: 'Org A' } }
      }]

      useTransfer.mockReturnValue({
        data: { ...mockTransferData, recommendation: TRANSFER_RECOMMENDATION.RECORD }
      })

      render(<TransferHistory transferHistory={history} />, { wrapper })
      expect(screen.getByText('Recommended recording transfer')).toBeInTheDocument()
    })

    it('handles RECOMMENDED status with REFUSE recommendation', () => {
      const history = [{
        transferStatus: { transferStatusId: 1, status: TRANSFER_STATUSES.RECOMMENDED },
        createDate: '2023-01-02',
        userProfile: { firstName: 'John', lastName: 'Doe', organization: { name: 'Org A' } }
      }]

      useTransfer.mockReturnValue({
        data: { ...mockTransferData, recommendation: TRANSFER_RECOMMENDATION.REFUSE }
      })

      render(<TransferHistory transferHistory={history} />, { wrapper })
      expect(screen.getByText('Recommended refusing transfer')).toBeInTheDocument()
    })

    it('handles non-RECOMMENDED status', () => {
      const history = [{
        transferStatus: { transferStatusId: 1, status: TRANSFER_STATUSES.SUBMITTED },
        createDate: '2023-01-02',
        userProfile: { firstName: 'John', lastName: 'Doe', organization: { name: 'Org A' } }
      }]

      render(<TransferHistory transferHistory={history} />, { wrapper })
      expect(screen.getByText('Signed and submitted')).toBeInTheDocument()
    })

    it('handles unknown status', () => {
      const history = [{
        transferStatus: { transferStatusId: 1, status: 'UNKNOWN_STATUS' },
        createDate: '2023-01-02',
        userProfile: { firstName: 'John', lastName: 'Doe', organization: { name: 'Org A' } }
      }]

      render(<TransferHistory transferHistory={history} />, { wrapper })
      expect(screen.getByText('Status not found')).toBeInTheDocument()
    })
  })

  describe('Category calculation logic', () => {
    it('uses transferCategory when provided', () => {
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: TRANSFER_STATUSES.SUBMITTED },
          agreementDate: '2023-01-01',
          transferCategory: { category: 'B' }
        }
      })
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: true } })

      render(<TransferHistory transferHistory={[]} />, { wrapper })
      expect(screen.getByText(/Category B/)).toBeInTheDocument()
    })

    it('defaults to calculated category when transferCategory not provided', () => {
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: TRANSFER_STATUSES.SUBMITTED },
          agreementDate: '2023-01-01'
        }
      })
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: true } })

      render(<TransferHistory transferHistory={[]} />, { wrapper })
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

    it('filters out DRAFT records', () => {
      const history = [
        {
          transferStatus: { transferStatusId: 1, status: TRANSFER_STATUSES.DRAFT },
          createDate: '2023-01-01',
          userProfile: { firstName: 'Draft', lastName: 'User', organization: { name: 'Draft Org' } }
        },
        {
          transferStatus: { transferStatusId: 2, status: TRANSFER_STATUSES.SUBMITTED },
          createDate: '2023-01-02',
          userProfile: { firstName: 'John', lastName: 'Doe', organization: { name: 'Org A' } }
        }
      ]

      render(<TransferHistory transferHistory={history} />, { wrapper })
      
      expect(screen.queryByText('Draft User')).not.toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    it('handles empty history after filtering', () => {
      const history = [
        {
          transferStatus: { transferStatusId: 1, status: TRANSFER_STATUSES.DRAFT },
          createDate: '2023-01-01',
          userProfile: { firstName: 'Draft', lastName: 'User', organization: { name: 'Draft Org' } }
        }
      ]

      render(<TransferHistory transferHistory={history} />, { wrapper })
      
      const listItems = screen.queryAllByRole('listitem')
      expect(listItems).toHaveLength(1) // Only agreement date item
    })

    it('handles undefined transferHistory', () => {
      render(<TransferHistory />, { wrapper })
      
      const listItems = screen.queryAllByRole('listitem')
      expect(listItems).toHaveLength(1) // Only agreement date item
    })
  })

  describe('User type rendering differences', () => {
    const mockTransferData = {
      currentStatus: { status: TRANSFER_STATUSES.SUBMITTED },
      agreementDate: '2023-01-01'
    }

    const recordedHistory = [{
      transferStatus: { transferStatusId: 1, status: TRANSFER_STATUSES.RECORDED },
      createDate: '2023-01-02',
      displayName: 'System User',
      userProfile: { firstName: 'John', lastName: 'Doe', organization: { name: 'Org A' } }
    }]

    beforeEach(() => {
      useTransfer.mockReturnValue({ data: mockTransferData })
    })

    it('shows director text for RECORDED status when user is not government', () => {
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: false } })

      render(<TransferHistory transferHistory={recordedHistory} />, { wrapper })
      
      expect(screen.getByText('Director')).toBeInTheDocument()
      expect(screen.getByText('Low Carbon Fuel Standard Act')).toBeInTheDocument()
    })

    it('shows user details for RECORDED status when user is government', () => {
      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: true } })

      render(<TransferHistory transferHistory={recordedHistory} />, { wrapper })
      
      expect(screen.getByText('System User')).toBeInTheDocument()
      expect(screen.getByText('Org A')).toBeInTheDocument()
    })

    it('shows user details for non-RECORDED status regardless of user type', () => {
      const nonRecordedHistory = [{
        transferStatus: { transferStatusId: 1, status: TRANSFER_STATUSES.SUBMITTED },
        createDate: '2023-01-02',
        userProfile: { firstName: 'John', lastName: 'Doe', organization: { name: 'Org A' } }
      }]

      useCurrentUser.mockReturnValue({ data: { isGovernmentUser: false } })

      render(<TransferHistory transferHistory={nonRecordedHistory} />, { wrapper })
      
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

    it('displays agreement date for qualifying statuses', () => {
      const qualifyingStatuses = [
        TRANSFER_STATUSES.SENT,
        TRANSFER_STATUSES.SUBMITTED,
        TRANSFER_STATUSES.RECOMMENDED,
        TRANSFER_STATUSES.RECORDED
      ]

      qualifyingStatuses.forEach(status => {
        useTransfer.mockReturnValue({
          data: { ...mockTransferData, currentStatus: { status } }
        })

        render(<TransferHistory transferHistory={[]} />, { wrapper })
        expect(screen.getByText(/Date of written agreement/)).toBeInTheDocument()
        cleanup()
      })
    })

    it('does not display agreement date for non-qualifying statuses', () => {
      useTransfer.mockReturnValue({
        data: { ...mockTransferData, currentStatus: { status: TRANSFER_STATUSES.DRAFT } }
      })

      render(<TransferHistory transferHistory={[]} />, { wrapper })
      expect(screen.queryByText(/Date of written agreement/)).not.toBeInTheDocument()
    })

    it('does not display agreement date when agreementDate is null', () => {
      useTransfer.mockReturnValue({
        data: { ...mockTransferData, agreementDate: null }
      })

      render(<TransferHistory transferHistory={[]} />, { wrapper })
      expect(screen.queryByText(/Date of written agreement/)).not.toBeInTheDocument()
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

    it('renders history items with user profile names', () => {
      const history = [{
        transferStatus: { transferStatusId: 1, status: TRANSFER_STATUSES.SUBMITTED },
        createDate: '2023-01-02',
        userProfile: { firstName: 'John', lastName: 'Doe', organization: { name: 'Org A' } }
      }]

      render(<TransferHistory transferHistory={history} />, { wrapper })
      
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Org A')).toBeInTheDocument()
    })

    it('renders history items with displayName when available', () => {
      const history = [{
        transferStatus: { transferStatusId: 1, status: TRANSFER_STATUSES.SUBMITTED },
        createDate: '2023-01-02',
        displayName: 'Custom Display Name',
        userProfile: { firstName: 'John', lastName: 'Doe', organization: { name: 'Org A' } }
      }]

      render(<TransferHistory transferHistory={history} />, { wrapper })
      
      expect(screen.getByText('Custom Display Name')).toBeInTheDocument()
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
    })

    it('handles missing organization gracefully', () => {
      const history = [{
        transferStatus: { transferStatusId: 1, status: TRANSFER_STATUSES.SUBMITTED },
        createDate: '2023-01-02',
        userProfile: { firstName: 'John', lastName: 'Doe' }
      }]

      render(<TransferHistory transferHistory={history} />, { wrapper })
      
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Government of BC')).toBeInTheDocument()
    })

    it('formats dates correctly', () => {
      const history = [{
        transferStatus: { transferStatusId: 1, status: TRANSFER_STATUSES.SUBMITTED },
        createDate: '2023-01-02T10:30:00Z',
        userProfile: { firstName: 'John', lastName: 'Doe', organization: { name: 'Org A' } }
      }]

      render(<TransferHistory transferHistory={history} />, { wrapper })
      
      expect(screen.getByText('Formatted: 2023-01-02T10:30:00Z')).toBeInTheDocument()
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

    it('renders main container with data-test attribute', () => {
      render(<TransferHistory transferHistory={[]} />, { wrapper })
      
      expect(screen.getByTestId('transfer-history')).toBeInTheDocument()
    })

    it('renders transaction history title', () => {
      render(<TransferHistory transferHistory={[]} />, { wrapper })
      
      expect(screen.getByText('Transaction History')).toBeInTheDocument()
    })

    it('renders list structure', () => {
      const history = [{
        transferStatus: { transferStatusId: 1, status: TRANSFER_STATUSES.SUBMITTED },
        createDate: '2023-01-02',
        userProfile: { firstName: 'John', lastName: 'Doe', organization: { name: 'Org A' } }
      }]

      render(<TransferHistory transferHistory={history} />, { wrapper })
      
      const list = screen.getByRole('list')
      expect(list).toBeInTheDocument()
      
      const listItems = screen.getAllByRole('listitem')
      expect(listItems).toHaveLength(2) // Agreement date + history item
    })
  })
})