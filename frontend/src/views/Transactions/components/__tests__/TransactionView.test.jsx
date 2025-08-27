import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TransactionView } from '../TransactionView'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

// Mock all dependencies
const mockUseCurrentUser = vi.hoisted(() => vi.fn())
const mockUseDocuments = vi.hoisted(() => vi.fn())
const mockUseDownloadDocument = vi.hoisted(() => vi.fn())
const mockNumberFormatter = vi.hoisted(() => vi.fn())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: vi.fn((key) => key)
  })
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: mockUseCurrentUser
}))

vi.mock('@/hooks/useDocuments.js', () => ({
  useDocuments: mockUseDocuments,
  useDownloadDocument: mockUseDownloadDocument
}))

vi.mock('@/utils/formatters', () => ({
  numberFormatter: mockNumberFormatter
}))

vi.mock('@/constants/roles', () => ({
  roles: {
    director: 'director'
  }
}))

vi.mock('@/constants/statuses', () => ({
  TRANSACTION_STATUSES: {
    RECOMMENDED: 'Recommended'
  }
}))

vi.mock('@/views/Transactions/constants.js', () => ({
  ADMIN_ADJUSTMENT: 'AdminAdjustment',
  INITIATIVE_AGREEMENT: 'InitiativeAgreement'
}))

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'mock-token',
      authenticated: true,
      initialized: true
    }
  })
}))

vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn()
  })
}))

const renderComponent = (props) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <TransactionView {...props} />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('TransactionView Component', () => {
  let mockHasAnyRole, mockViewDocument

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockHasAnyRole = vi.fn()
    mockViewDocument = vi.fn()
    
    mockUseCurrentUser.mockReturnValue({
      hasAnyRole: mockHasAnyRole
    })
    
    mockUseDocuments.mockReturnValue({
      data: []
    })
    
    mockUseDownloadDocument.mockReturnValue(mockViewDocument)
    
    mockNumberFormatter.mockReturnValue('1,000')
  })

  const mockTransaction = {
    adminAdjustmentId: 123,
    toOrganization: { name: 'Test Organization' },
    complianceUnits: '1000',
    transactionEffectiveDate: '2023-05-01',
    govComment: 'Test comment',
    currentStatus: { status: 'Draft' }
  }

  it('renders basic transaction information correctly', () => {
    renderComponent({ transaction: mockTransaction })
    
    expect(screen.getByText(/txn:administrativeAdjustment/)).toBeInTheDocument()
    expect(screen.getByText(/Test Organization/)).toBeInTheDocument()
    expect(screen.getByText(/txn:complianceUnitsLabel/)).toBeInTheDocument()
    expect(screen.getByText(/1,000/)).toBeInTheDocument()
    expect(screen.getByText(/txn:effectiveDateLabel/)).toBeInTheDocument()
    expect(screen.getByText(/2023-05-01/)).toBeInTheDocument()
  })

  it('displays admin adjustment when adminAdjustmentId exists', () => {
    renderComponent({ transaction: mockTransaction })
    
    expect(screen.getByText(/txn:administrativeAdjustment/)).toBeInTheDocument()
    expect(mockUseDocuments).toHaveBeenCalledWith('AdminAdjustment', 123)
    expect(mockUseDownloadDocument).toHaveBeenCalledWith('AdminAdjustment', 123)
  })

  it('displays initiative agreement when adminAdjustmentId is null', () => {
    const initiativeTransaction = {
      ...mockTransaction,
      adminAdjustmentId: null,
      initiativeAgreementId: 456
    }
    
    renderComponent({ transaction: initiativeTransaction })
    
    expect(screen.getByText(/txn:initiativeAgreement/)).toBeInTheDocument()
    expect(mockUseDocuments).toHaveBeenCalledWith('InitiativeAgreement', 456)
    expect(mockUseDownloadDocument).toHaveBeenCalledWith('InitiativeAgreement', 456)
  })

  it('displays unknown organization when toOrganization is null', () => {
    const transactionWithoutOrg = {
      ...mockTransaction,
      toOrganization: null
    }
    
    renderComponent({ transaction: transactionWithoutOrg })
    
    expect(screen.getByText(/common:unknown/)).toBeInTheDocument()
  })

  it('displays unknown organization when toOrganization.name is undefined', () => {
    const transactionWithEmptyOrg = {
      ...mockTransaction,
      toOrganization: {}
    }
    
    renderComponent({ transaction: transactionWithEmptyOrg })
    
    expect(screen.getByText(/common:unknown/)).toBeInTheDocument()
  })

  it('displays regular comments when not recommended status', () => {
    renderComponent({ transaction: mockTransaction })
    
    expect(screen.getByText(/txn:comments/)).toBeInTheDocument()
    expect(screen.getByText(/Test comment/)).toBeInTheDocument()
  })

  it('displays editable comments for director when recommended status', () => {
    const recommendedTransaction = {
      ...mockTransaction,
      currentStatus: { status: 'Recommended' }
    }
    
    mockHasAnyRole.mockReturnValue(true)
    
    renderComponent({ transaction: recommendedTransaction })
    
    expect(screen.getByText(/txn:editableComments/)).toBeInTheDocument()
    expect(mockHasAnyRole).toHaveBeenCalledWith('director')
  })

  it('displays regular comments for non-director when recommended status', () => {
    const recommendedTransaction = {
      ...mockTransaction,
      currentStatus: { status: 'Recommended' }
    }
    
    mockHasAnyRole.mockReturnValue(false)
    
    renderComponent({ transaction: recommendedTransaction })
    
    expect(screen.getByText(/txn:comments/)).toBeInTheDocument()
  })

  it('displays regular comments for director when not recommended status', () => {
    mockHasAnyRole.mockReturnValue(true)
    
    renderComponent({ transaction: mockTransaction })
    
    expect(screen.getByText(/txn:comments/)).toBeInTheDocument()
  })

  it('displays attachments section', () => {
    renderComponent({ transaction: mockTransaction })
    
    expect(screen.getByText(/txn:attachments/)).toBeInTheDocument()
  })

  it('displays no files when loadedFiles is empty', () => {
    mockUseDocuments.mockReturnValue({
      data: []
    })
    
    renderComponent({ transaction: mockTransaction })
    
    expect(screen.getByText(/txn:attachments/)).toBeInTheDocument()
    expect(screen.queryByText(/test-file.pdf/)).not.toBeInTheDocument()
  })

  it('displays no files when loadedFiles is null', () => {
    mockUseDocuments.mockReturnValue({
      data: null
    })
    
    renderComponent({ transaction: mockTransaction })
    
    expect(screen.getByText(/txn:attachments/)).toBeInTheDocument()
    expect(screen.queryByText(/test-file.pdf/)).not.toBeInTheDocument()
  })

  it('displays files when loadedFiles contains files', () => {
    const mockFiles = [
      { documentId: 1, fileName: 'test-file.pdf' },
      { documentId: 2, fileName: 'another-file.doc' }
    ]
    
    mockUseDocuments.mockReturnValue({
      data: mockFiles
    })
    
    renderComponent({ transaction: mockTransaction })
    
    expect(screen.getByText(/test-file.pdf/)).toBeInTheDocument()
    expect(screen.getByText(/another-file.doc/)).toBeInTheDocument()
  })

  it('calls viewDocument when file is clicked', () => {
    const mockFiles = [
      { documentId: 1, fileName: 'test-file.pdf' }
    ]
    
    mockUseDocuments.mockReturnValue({
      data: mockFiles
    })
    
    renderComponent({ transaction: mockTransaction })
    
    const fileLink = screen.getByText(/test-file.pdf/)
    fireEvent.click(fileLink)
    
    expect(mockViewDocument).toHaveBeenCalledWith(1)
  })

  it('handles multiple file clicks', () => {
    const mockFiles = [
      { documentId: 1, fileName: 'file1.pdf' },
      { documentId: 2, fileName: 'file2.doc' }
    ]
    
    mockUseDocuments.mockReturnValue({
      data: mockFiles
    })
    
    renderComponent({ transaction: mockTransaction })
    
    const file1Link = screen.getByText(/file1.pdf/)
    const file2Link = screen.getByText(/file2.doc/)
    
    fireEvent.click(file1Link)
    fireEvent.click(file2Link)
    
    expect(mockViewDocument).toHaveBeenCalledWith(1)
    expect(mockViewDocument).toHaveBeenCalledWith(2)
    expect(mockViewDocument).toHaveBeenCalledTimes(2)
  })

  it('calls numberFormatter with compliance units', () => {
    renderComponent({ transaction: mockTransaction })
    
    expect(mockNumberFormatter).toHaveBeenCalledWith('1000')
  })

  it('handles empty effective date', () => {
    const transactionWithoutDate = {
      ...mockTransaction,
      transactionEffectiveDate: null
    }
    
    renderComponent({ transaction: transactionWithoutDate })
    
    expect(screen.getByText(/txn:effectiveDateLabel/)).toBeInTheDocument()
  })

  it('handles empty gov comment', () => {
    const transactionWithoutComment = {
      ...mockTransaction,
      govComment: ''
    }
    
    renderComponent({ transaction: transactionWithoutComment })
    
    expect(screen.getByText(/txn:comments/)).toBeInTheDocument()
  })

  it('calls useDocuments with undefined when no transaction IDs', () => {
    const transactionWithNoIds = {
      ...mockTransaction,
      adminAdjustmentId: null,
      initiativeAgreementId: null
    }
    
    renderComponent({ transaction: transactionWithNoIds })
    
    expect(mockUseDocuments).toHaveBeenCalledWith('InitiativeAgreement', null)
    expect(mockUseDownloadDocument).toHaveBeenCalledWith('InitiativeAgreement', null)
  })
})