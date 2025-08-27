import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SupportingDocumentSummary } from '../SupportingDocumentSummary'

// Mock dependencies
vi.mock('@/hooks/useDocuments.js', () => ({
  useDownloadDocument: vi.fn()
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn()
}))

vi.mock('@/utils/formatters', () => ({
  timezoneFormatter: vi.fn()
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, onClick, ...props }) => (
    <span data-test="bc-typography" onClick={onClick} {...props}>
      {children}
    </span>
  )
}))

describe('SupportingDocumentSummary', () => {
  const mockDownloadDocument = vi.fn()
  const mockHasRoles = vi.fn()
  const mockTimezoneFormatter = vi.fn()

  const defaultProps = {
    parentID: 123,
    parentType: 'test-type',
    data: []
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Setup default mock implementations
    const { useDownloadDocument } = await import('@/hooks/useDocuments.js')
    const { useCurrentUser } = await import('@/hooks/useCurrentUser')
    const { timezoneFormatter } = await import('@/utils/formatters')
    
    vi.mocked(useDownloadDocument).mockReturnValue(mockDownloadDocument)
    vi.mocked(useCurrentUser).mockReturnValue({ hasRoles: mockHasRoles })
    vi.mocked(timezoneFormatter).mockImplementation(mockTimezoneFormatter)
    
    mockTimezoneFormatter.mockReturnValue('2023-01-01 12:00')
  })

  it('renders main component with empty data', () => {
    render(<SupportingDocumentSummary {...defaultProps} />)
    
    // Should render the empty list container but no document items
    expect(screen.queryByTestId('bc-typography')).not.toBeInTheDocument()
  })

  it('renders empty data array without items', () => {
    render(<SupportingDocumentSummary {...defaultProps} data={[]} />)
    
    // Should render no document items
    expect(screen.queryByTestId('bc-typography')).not.toBeInTheDocument()
    expect(screen.queryByText(/test-file/)).not.toBeInTheDocument()
  })

  it('renders single document', () => {
    const singleDocData = [{
      documentId: 1,
      fileName: 'test-document.pdf',
      createDate: '2023-01-01T12:00:00Z',
      createUser: 'Test User'
    }]
    
    mockHasRoles.mockReturnValue(false)

    render(<SupportingDocumentSummary {...defaultProps} data={singleDocData} />)
    
    expect(screen.getByText('test-document.pdf')).toBeInTheDocument()
    expect(mockTimezoneFormatter).toHaveBeenCalledWith({ value: '2023-01-01T12:00:00Z' })
  })

  it('renders multiple documents', () => {
    const multipleDocsData = [
      {
        documentId: 1,
        fileName: 'document-1.pdf',
        createDate: '2023-01-01T12:00:00Z',
        createUser: 'User 1'
      },
      {
        documentId: 2,
        fileName: 'document-2.pdf',
        createDate: '2023-01-02T12:00:00Z',
        createUser: 'User 2'
      }
    ]
    
    mockHasRoles.mockReturnValue(false)

    render(<SupportingDocumentSummary {...defaultProps} data={multipleDocsData} />)
    
    expect(screen.getByText('document-1.pdf')).toBeInTheDocument()
    expect(screen.getByText('document-2.pdf')).toBeInTheDocument()
  })

  it('calls downloadDocument when file name is clicked', () => {
    const docData = [{
      documentId: 123,
      fileName: 'clickable-document.pdf',
      createDate: '2023-01-01T12:00:00Z'
    }]
    
    render(<SupportingDocumentSummary {...defaultProps} data={docData} />)
    
    const fileName = screen.getByText('clickable-document.pdf')
    fireEvent.click(fileName)
    
    expect(mockDownloadDocument).toHaveBeenCalledWith(123)
  })

  it('formats timezone correctly', () => {
    const docData = [{
      documentId: 1,
      fileName: 'test.pdf',
      createDate: '2023-06-15T14:30:00Z'
    }]
    
    mockTimezoneFormatter.mockReturnValue('Jun 15, 2023 2:30 PM')

    render(<SupportingDocumentSummary {...defaultProps} data={docData} />)
    
    expect(mockTimezoneFormatter).toHaveBeenCalledWith({ value: '2023-06-15T14:30:00Z' })
    expect(screen.getByText(/Jun 15, 2023 2:30 PM/)).toBeInTheDocument()
  })

  it('displays createUser when user does not have Supplier role', () => {
    const docData = [{
      documentId: 1,
      fileName: 'test.pdf',
      createDate: '2023-01-01T12:00:00Z',
      createUser: 'John Doe'
    }]
    
    mockHasRoles.mockReturnValue(false) // Not a supplier

    render(<SupportingDocumentSummary {...defaultProps} data={docData} />)
    
    expect(screen.getByText(/- John Doe/)).toBeInTheDocument()
  })

  it('hides createUser when user has Supplier role', () => {
    const docData = [{
      documentId: 1,
      fileName: 'test.pdf',
      createDate: '2023-01-01T12:00:00Z',
      createUser: 'John Doe'
    }]
    
    mockHasRoles.mockReturnValue(true) // Is a supplier

    render(<SupportingDocumentSummary {...defaultProps} data={docData} />)
    
    expect(screen.queryByText(/- John Doe/)).not.toBeInTheDocument()
  })

  it('handles missing createUser gracefully', () => {
    const docData = [{
      documentId: 1,
      fileName: 'test.pdf',
      createDate: '2023-01-01T12:00:00Z'
      // No createUser property
    }]
    
    mockHasRoles.mockReturnValue(false)

    render(<SupportingDocumentSummary {...defaultProps} data={docData} />)
    
    // Should only display timestamp, not user info 
    const timestampElement = screen.getByText('- 2023-01-01 12:00')
    expect(timestampElement).toBeInTheDocument()
    expect(screen.getByText('test.pdf')).toBeInTheDocument()
    
    // The text content should not include additional user info beyond the timestamp
    expect(timestampElement.textContent).toBe('- 2023-01-01 12:00')
  })

  it('calls useDownloadDocument hook with correct parameters', async () => {
    const { useDownloadDocument } = await import('@/hooks/useDocuments.js')
    
    render(<SupportingDocumentSummary parentID={456} parentType="compliance-report" data={[]} />)
    
    expect(useDownloadDocument).toHaveBeenCalledWith('compliance-report', 456)
  })

  it('calls useCurrentUser hook', async () => {
    const { useCurrentUser } = await import('@/hooks/useCurrentUser')
    
    render(<SupportingDocumentSummary {...defaultProps} />)
    
    expect(useCurrentUser).toHaveBeenCalled()
  })
})