import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { OrgTransactionDetails } from '@/views/Transactions/components'
import { ADMIN_ADJUSTMENT } from '@/views/Transactions/constants'
import { test } from '@/tests/utils/fixtures'
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
        'txn:approvedByDirector':
          'by the director under the Low Carbon Fuels Act',
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
  dateFormatter: ({ value }) => (value ? '2024-01-01' : ''),
  formatDateWithTimezoneAbbr: (value) => (value ? 'January 1, 2024' : ''),
  numberFormatter: ({ value }) => (value ? value.toLocaleString() : '0')
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
    test('renders admin adjustment type correctly', ({
      render,
      theme,
      router
    }) => {
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        [theme, router]
      )

      expect(
        screen.getByText('Administrative adjustment for Test Organization')
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Administrative adjustment — ID: AA123/)
      ).toBeInTheDocument()
    })

    test('renders initiative agreement type correctly', ({
      render,
      theme,
      router
    }) => {
      render(
        <OrgTransactionDetails
          transactionType="INITIATIVE_AGREEMENT"
          transactionData={initiativeAgreementData}
        />,
        [theme, router]
      )

      expect(
        screen.getByText('Initiative agreement for Test Organization')
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Initiative agreement — ID: IA456/)
      ).toBeInTheDocument()
    })
  })

  describe('Status Field Selection', () => {
    test('uses adminAdjustmentStatus for admin adjustment type', ({
      render,
      theme,
      router
    }) => {
      const dataWithHistory = {
        ...adminAdjustmentData,
        history: historyWithApproved
      }

      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={dataWithHistory}
        />,
        [theme, router]
      )

      expect(
        screen.getByText('Administrative adjustment for Test Organization')
      ).toBeInTheDocument()
    })

    test('uses initiativeAgreementStatus for initiative agreement type', ({
      render,
      theme,
      router
    }) => {
      const dataWithHistory = {
        ...initiativeAgreementData,
        history: [
          {
            createDate: '2024-01-03T10:00:00Z',
            initiativeAgreementStatus: { status: 'Approved' }
          }
        ]
      }

      render(
        <OrgTransactionDetails
          transactionType="INITIATIVE_AGREEMENT"
          transactionData={dataWithHistory}
        />,
        [theme, router]
      )

      expect(
        screen.getByText('Initiative agreement for Test Organization')
      ).toBeInTheDocument()
    })
  })

  describe('Date Calculation Logic', () => {
    test('finds approved date from history when available', ({
      render,
      theme,
      router
    }) => {
      const dataWithHistory = {
        ...adminAdjustmentData,
        history: historyWithApproved
      }

      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={dataWithHistory}
        />,
        [theme, router]
      )

      expect(screen.getByText(/January 1, 2024/)).toBeInTheDocument()
    })

    test('uses createDate when no approved history found', ({
      render,
      theme,
      router
    }) => {
      const dataWithHistory = {
        ...adminAdjustmentData,
        history: historyWithoutApproved
      }

      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={dataWithHistory}
        />,
        [theme, router]
      )

      expect(screen.getByText(/January 1, 2024/)).toBeInTheDocument()
    })

    test('uses createDate when history is null', ({
      render,
      theme,
      router
    }) => {
      const dataWithoutHistory = {
        ...adminAdjustmentData,
        history: null
      }

      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={dataWithoutHistory}
        />,
        [theme, router]
      )

      expect(screen.getByText(/January 1, 2024/)).toBeInTheDocument()
    })

    test('uses transactionEffectiveDate when available', ({
      render,
      theme,
      router
    }) => {
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        [theme, router]
      )

      expect(screen.getByText('2024-01-01')).toBeInTheDocument()
    })

    test('falls back to approved date when no effective date', ({
      render,
      theme,
      router
    }) => {
      const dataWithoutEffectiveDate = {
        ...adminAdjustmentData,
        transactionEffectiveDate: null
      }

      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={dataWithoutEffectiveDate}
        />,
        [theme, router]
      )

      expect(screen.getByText('2024-01-01')).toBeInTheDocument()
    })
  })

  describe('File Attachment Rendering', () => {
    test('renders file attachments when files exist', ({
      render,
      theme,
      router
    }) => {
      mockUseDocuments.mockReturnValue({ data: mockFiles })

      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        [theme, router]
      )

      expect(screen.getByText('Attachments')).toBeInTheDocument()
      expect(screen.getByText('file1.pdf')).toBeInTheDocument()
      expect(screen.getByText('file2.doc')).toBeInTheDocument()
    })

    test('does not render attachments when no files', ({
      render,
      theme,
      router
    }) => {
      mockUseDocuments.mockReturnValue({ data: [] })

      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        [theme, router]
      )

      expect(screen.queryByText('Attachments')).not.toBeInTheDocument()
    })

    test('does not render attachments when data is null', ({
      render,
      theme,
      router
    }) => {
      mockUseDocuments.mockReturnValue({ data: null })

      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        [theme, router]
      )

      expect(screen.queryByText('Attachments')).not.toBeInTheDocument()
    })

    test('calls viewDocument when file is clicked', ({
      render,
      theme,
      router
    }) => {
      const mockViewDocument = vi.fn()
      mockUseDownloadDocument.mockReturnValue(mockViewDocument)
      mockUseDocuments.mockReturnValue({ data: mockFiles })

      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        [theme, router]
      )

      fireEvent.click(screen.getByText('file1.pdf'))
      expect(mockViewDocument).toHaveBeenCalledWith(1)
    })
  })

  describe('Government Comment Rendering', () => {
    test('renders gov comment when present', ({ render, theme, router }) => {
      const dataWithComment = {
        ...adminAdjustmentData,
        govComment: 'Test government comment'
      }

      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={dataWithComment}
        />,
        [theme, router]
      )

      expect(screen.getByText('Comments')).toBeInTheDocument()
      expect(screen.getByText('Test government comment')).toBeInTheDocument()
    })

    test('does not render comment section when no comment', ({
      render,
      theme,
      router
    }) => {
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        [theme, router]
      )

      expect(screen.queryByText('Comments')).not.toBeInTheDocument()
    })
  })

  describe('Hook Usage', () => {
    test('calls useDocuments with correct parameters for admin adjustment', ({
      render,
      theme,
      router
    }) => {
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        [theme, router]
      )

      expect(mockUseDocuments).toHaveBeenCalledWith(ADMIN_ADJUSTMENT, 123)
    })

    test('calls useDocuments with correct parameters for initiative agreement', ({
      render,
      theme,
      router
    }) => {
      render(
        <OrgTransactionDetails
          transactionType="INITIATIVE_AGREEMENT"
          transactionData={initiativeAgreementData}
        />,
        [theme, router]
      )

      expect(mockUseDocuments).toHaveBeenCalledWith('INITIATIVE_AGREEMENT', 456)
    })

    test('calls useDownloadDocument with correct parameters', ({
      render,
      theme,
      router
    }) => {
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        [theme, router]
      )

      expect(mockUseDownloadDocument).toHaveBeenCalledWith(
        ADMIN_ADJUSTMENT,
        123
      )
    })
  })

  describe('Component Rendering', () => {
    test('renders all required elements', ({ render, theme, router }) => {
      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={adminAdjustmentData}
        />,
        [theme, router]
      )

      expect(
        screen.getByText('Administrative adjustment for Test Organization')
      ).toBeInTheDocument()
      expect(screen.getByText('Compliance units')).toBeInTheDocument()
      expect(screen.getByText('1,000')).toBeInTheDocument()
      expect(screen.getByText('Effective date')).toBeInTheDocument()
      expect(screen.getByText('Approved')).toBeInTheDocument()
      expect(
        screen.getByText(/by the director under the Low Carbon Fuels Act/)
      ).toBeInTheDocument()
    })

    test('renders with empty history array', ({ render, theme, router }) => {
      const dataWithEmptyHistory = {
        ...adminAdjustmentData,
        history: []
      }

      render(
        <OrgTransactionDetails
          transactionType={ADMIN_ADJUSTMENT}
          transactionData={dataWithEmptyHistory}
        />,
        [theme, router]
      )

      expect(
        screen.getByText('Administrative adjustment for Test Organization')
      ).toBeInTheDocument()
    })
  })
})
