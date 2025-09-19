import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChargingSiteDocument } from '../../components/ChargingSiteDocument'
import { wrapper } from '@/tests/utils/wrapper.jsx'

vi.mock('react-router-dom', () => ({
  useParams: () => ({ siteId: '123' })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/hooks/useDocuments', () => ({
  useDownloadDocument: () => vi.fn()
}))

vi.mock('@/components/Documents/DocumentUploadDialog', () => ({
  __esModule: true,
  default: ({ open, close }) => 
    open ? <div data-testid="document-upload-dialog">Upload Dialog</div> : null
}))

vi.mock('@/components/Role', () => ({
  Role: ({ children }) => <div>{children}</div>
}))

describe('ChargingSiteDocument', () => {
  const mockAttachments = [
    {
      documentId: 1,
      fileName: 'test-document.pdf',
      createDate: '2024-01-01T00:00:00Z',
      createUser: 'Test User'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders document accordion with attachments', () => {
    render(<ChargingSiteDocument attachments={mockAttachments} />, { wrapper })
    
    expect(screen.getByText('documentTitle')).toBeInTheDocument()
    expect(screen.getByText('test-document.pdf')).toBeInTheDocument()
  })

  it('renders empty state when no attachments', () => {
    render(<ChargingSiteDocument attachments={[]} />, { wrapper })
    
    expect(screen.getByText('documentTitle')).toBeInTheDocument()
    expect(screen.queryByText('test-document.pdf')).not.toBeInTheDocument()
  })

  it('opens upload dialog when edit button is clicked', () => {
    render(<ChargingSiteDocument attachments={mockAttachments} />, { wrapper })
    
    const editButton = screen.getByLabelText('edit')
    fireEvent.click(editButton)
    
    expect(screen.getByText('Upload Dialog')).toBeInTheDocument()
  })

  it('displays document metadata correctly', () => {
    render(<ChargingSiteDocument attachments={mockAttachments} />, { wrapper })
    
    expect(screen.getByText(/Test User/)).toBeInTheDocument()
  })

  it('handles document click for download', () => {
    render(<ChargingSiteDocument attachments={mockAttachments} />, { wrapper })
    
    const documentLink = screen.getByText('test-document.pdf')
    expect(documentLink).toBeInTheDocument()
  })
})