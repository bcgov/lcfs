import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { OrgTransactionDetails } from '@/views/Transactions/components'
import { ADMIN_ADJUSTMENT } from '@/views/Transactions/constants'
import { wrapper } from '@/tests/utils/wrapper.jsx'
import { useDocuments, useDownloadDocument } from '@/hooks/useDocuments.js'

// Mock hooks
vi.mock('@/hooks/useDocuments.js', () => ({
  useDocuments: vi.fn(),
  useDownloadDocument: vi.fn()
}))

const mockUseDocuments = vi.mocked(useDocuments)
const mockUseDownloadDocument = vi.mocked(useDownloadDocument)

// Mock translations
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'txn:administrativeAdjustment': 'Administrative adjustment',
        'txn:initiativeAgreement': 'Initiative agreement',
        'txn:complianceUnitsLabel': 'Compliance units',
        'txn:effectiveDateLabel': 'Effective date',
        'txn:commentsTextLabel': 'Comments',
        'txn:approvedLabel': 'Approved',
        'txn:approvedByDirector': 'by the director under the Low Carbon Fuels Act',
        'txn:for': 'for',
        'txn:adminAdjustmentId': 'Administrative adjustment — ID:',
        'txn:initiativeAgreementId': 'Initiative agreement — ID:',
        'txn:attachments': 'Attachments'
      }
      return translations[key] || key
    }
  })
}))

// Mock formatters
vi.mock('@/utils/formatters', () => ({
  dateFormatter: ({ value }) => value ? '2024-01-01' : '',
  formatDateWithTimezoneAbbr: (value) => value ? 'January 1, 2024' : '',
  numberFormatter: ({ value }) => value ? value.toLocaleString() : '0'
}))

// Test data fixtures
const baseTransactionData = {
  complianceUnits: 1000,
  toOrganization: { name: 'Test Organization' },
  createDate: '2024-01-01T10:00:00Z'
}

const adminAdjustmentData = {
  ...baseTransactionData,
  adminAdjustmentId: 123,
  transactionEffectiveDate: '2024-02-01'
}

const initiativeAgreementData = {
  ...baseTransactionData,
  initiativeAgreementId: 456,
  transactionEffectiveDate: '2024-03-01'
}

const historyWithApproved = [
  {
    createDate: '2024-01-02T10:00:00Z',
    adminAdjustmentStatus: { status: 'Draft' }
  },
  {
    createDate: '2024-01-03T10:00:00Z',
    adminAdjustmentStatus: { status: 'Approved' }
  }
]

const historyWithoutApproved = [
  {
    createDate: '2024-01-02T10:00:00Z',
    adminAdjustmentStatus: { status: 'Draft' }
  }
]

const mockFiles = [
  { documentId: 1, fileName: 'file1.pdf' },
  { documentId: 2, fileName: 'file2.doc' }
]

describe('OrgTransactionDetails Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseDocuments.mockReturnValue({ data: null })
    mockUseDownloadDocument.mockReturnValue(vi.fn())
  })

  describe('Transaction Type Conditional Logic', () => {
    it('renders admin adjustment type correctly', () => {
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        { wrapper }
      )
      
      expect(screen.getByText('Administrative adjustment for Test Organization')).toBeInTheDocument()
      expect(screen.getByText(/Administrative adjustment — ID: AA123/)).toBeInTheDocument()
    })

    it('renders initiative agreement type correctly', () => {
      render(
        <OrgTransactionDetails
          transactionType="INITIATIVE_AGREEMENT"
          transactionData={initiativeAgreementData}
        />,
        { wrapper }
      )
      
      expect(screen.getByText('Initiative agreement for Test Organization')).toBeInTheDocument()
      expect(screen.getByText(/Initiative agreement — ID: IA456/)).toBeInTheDocument()
    })
  })

  describe('Status Field Selection', () => {
    it('uses adminAdjustmentStatus for admin adjustment type', () => {
      const dataWithHistory = {
        ...adminAdjustmentData,
        history: historyWithApproved
      }
      
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={dataWithHistory}
        />,
        { wrapper }
      )
      
      expect(screen.getByText('Administrative adjustment for Test Organization')).toBeInTheDocument()
    })

    it('uses initiativeAgreementStatus for initiative agreement type', () => {
      const dataWithHistory = {
        ...initiativeAgreementData,
        history: [{
          createDate: '2024-01-03T10:00:00Z',
          initiativeAgreementStatus: { status: 'Approved' }
        }]
      }
      
      render(
        <OrgTransactionDetails
          transactionType="INITIATIVE_AGREEMENT"
          transactionData={dataWithHistory}
        />,
        { wrapper }
      )
      
      expect(screen.getByText('Initiative agreement for Test Organization')).toBeInTheDocument()
    })
  })

  describe('Date Calculation Logic', () => {
    it('finds approved date from history when available', () => {
      const dataWithHistory = {
        ...adminAdjustmentData,
        history: historyWithApproved
      }
      
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={dataWithHistory}
        />,
        { wrapper }
      )
      
      expect(screen.getByText(/January 1, 2024/)).toBeInTheDocument()
    })

    it('uses createDate when no approved history found', () => {
      const dataWithHistory = {
        ...adminAdjustmentData,
        history: historyWithoutApproved
      }
      
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={dataWithHistory}
        />,
        { wrapper }
      )
      
      expect(screen.getByText(/January 1, 2024/)).toBeInTheDocument()
    })

    it('uses createDate when history is null', () => {
      const dataWithoutHistory = {
        ...adminAdjustmentData,
        history: null
      }
      
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={dataWithoutHistory}
        />,
        { wrapper }
      )
      
      expect(screen.getByText(/January 1, 2024/)).toBeInTheDocument()
    })

    it('uses transactionEffectiveDate when available', () => {
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        { wrapper }
      )
      
      expect(screen.getByText('2024-01-01')).toBeInTheDocument()
    })

    it('falls back to approved date when no effective date', () => {
      const dataWithoutEffectiveDate = {
        ...adminAdjustmentData,
        transactionEffectiveDate: null
      }
      
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={dataWithoutEffectiveDate}
        />,
        { wrapper }
      )
      
      expect(screen.getByText('2024-01-01')).toBeInTheDocument()
    })
  })

  describe('File Attachment Rendering', () => {
    it('renders file attachments when files exist', () => {
      mockUseDocuments.mockReturnValue({ data: mockFiles })
      
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        { wrapper }
      )
      
      expect(screen.getByText('Attachments')).toBeInTheDocument()
      expect(screen.getByText('file1.pdf')).toBeInTheDocument()
      expect(screen.getByText('file2.doc')).toBeInTheDocument()
    })

    it('does not render attachments when no files', () => {
      mockUseDocuments.mockReturnValue({ data: [] })
      
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        { wrapper }
      )
      
      expect(screen.queryByText('Attachments')).not.toBeInTheDocument()
    })

    it('does not render attachments when data is null', () => {
      mockUseDocuments.mockReturnValue({ data: null })
      
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        { wrapper }
      )
      
      expect(screen.queryByText('Attachments')).not.toBeInTheDocument()
    })

    it('calls viewDocument when file is clicked', () => {
      const mockViewDocument = vi.fn()
      mockUseDownloadDocument.mockReturnValue(mockViewDocument)
      mockUseDocuments.mockReturnValue({ data: mockFiles })
      
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        { wrapper }
      )
      
      fireEvent.click(screen.getByText('file1.pdf'))
      expect(mockViewDocument).toHaveBeenCalledWith(1)
    })
  })

  describe('Government Comment Rendering', () => {
    it('renders gov comment when present', () => {
      const dataWithComment = {
        ...adminAdjustmentData,
        govComment: 'Test government comment'
      }
      
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={dataWithComment}
        />,
        { wrapper }
      )
      
      expect(screen.getByText('Comments')).toBeInTheDocument()
      expect(screen.getByText('Test government comment')).toBeInTheDocument()
    })

    it('does not render comment section when no comment', () => {
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        { wrapper }
      )
      
      expect(screen.queryByText('Comments')).not.toBeInTheDocument()
    })
  })

  describe('Hook Usage', () => {
    it('calls useDocuments with correct parameters for admin adjustment', () => {
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        { wrapper }
      )
      
      expect(mockUseDocuments).toHaveBeenCalledWith(ADMIN_ADJUSTMENT, 123)
    })

    it('calls useDocuments with correct parameters for initiative agreement', () => {
      render(
        <OrgTransactionDetails
          transactionType="INITIATIVE_AGREEMENT"
          transactionData={initiativeAgreementData}
        />,
        { wrapper }
      )
      
      expect(mockUseDocuments).toHaveBeenCalledWith('INITIATIVE_AGREEMENT', 456)
    })

    it('calls useDownloadDocument with correct parameters', () => {
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        { wrapper }
      )
      
      expect(mockUseDownloadDocument).toHaveBeenCalledWith(ADMIN_ADJUSTMENT, 123)
    })
  })

  describe('Component Rendering', () => {
    it('renders all required elements', () => {
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        { wrapper }
      )
      
      expect(screen.getByText('Administrative adjustment for Test Organization')).toBeInTheDocument()
      expect(screen.getByText('Compliance units')).toBeInTheDocument()
      expect(screen.getByText('1,000')).toBeInTheDocument()
      expect(screen.getByText('Effective date')).toBeInTheDocument()
      expect(screen.getByText('Approved')).toBeInTheDocument()
      expect(screen.getByText(/by the director under the Low Carbon Fuels Act/)).toBeInTheDocument()
    })

    it('renders with empty history array', () => {
      const dataWithEmptyHistory = {
        ...adminAdjustmentData,
        history: []
      }
      
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={dataWithEmptyHistory}
        />,
        { wrapper }
      )
      
      expect(screen.getByText('Administrative adjustment for Test Organization')).toBeInTheDocument()
    })
  })
})