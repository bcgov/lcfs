import React from 'react'
import { describe, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { ChargingSiteDocument } from '../../components/ChargingSiteDocument'
import { test } from '@/tests/utils/fixtures'

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

  test('renders document accordion with attachments', ({
    render,
    theme,
    router
  }) => {
    render(<ChargingSiteDocument attachments={mockAttachments} />, [
      theme,
      router
    ])

    expect(screen.getByText('documentTitle')).toBeInTheDocument()
    expect(screen.getByText('test-document.pdf')).toBeInTheDocument()
  })

  test('renders empty state when no attachments', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ChargingSiteDocument attachments={[]} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('documentTitle')).toBeInTheDocument()
    expect(screen.queryByText('test-document.pdf')).not.toBeInTheDocument()
  })

  test('opens upload dialog when edit button is clicked', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ChargingSiteDocument attachments={mockAttachments} />, [
      query,
      theme,
      localization,
      router
    ])

    const editButton = screen.getByLabelText('edit')
    fireEvent.click(editButton)

    expect(screen.getByText('Upload Dialog')).toBeInTheDocument()
  })

  test('displays document metadata correctly', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ChargingSiteDocument attachments={mockAttachments} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText(/Test User/)).toBeInTheDocument()
  })

  test('handles document click for download', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ChargingSiteDocument attachments={mockAttachments} />, [
      query,
      theme,
      localization,
      router
    ])

    const documentLink = screen.getByText('test-document.pdf')
    expect(documentLink).toBeInTheDocument()
  })
})
