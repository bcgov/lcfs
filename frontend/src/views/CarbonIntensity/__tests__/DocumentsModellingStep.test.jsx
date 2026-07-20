import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'

import { DocumentsModellingStep } from '@/views/CarbonIntensity/components/DocumentsModellingStep'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

let mockDocs = []
const mockUpload = vi.fn().mockResolvedValue({})
const mockDelete = vi.fn().mockResolvedValue({})
const mockDownloadDoc = vi.fn().mockResolvedValue({})

vi.mock('@/hooks/useDocuments', () => ({
  useDocuments: vi.fn(() => ({ data: mockDocs, isLoading: false })),
  useUploadDocument: vi.fn(() => ({
    mutateAsync: mockUpload,
    isPending: false
  })),
  useDeleteDocument: vi.fn(() => ({
    mutateAsync: mockDelete,
    isPending: false
  })),
  useDownloadDocument: vi.fn(() => mockDownloadDoc)
}))

const mockDownload = vi.fn().mockResolvedValue({})
vi.mock('@/services/useApiService', () => ({
  useApiService: () => ({ download: mockDownload, get: vi.fn(), post: vi.fn() })
}))

const baseCi = { ciApplicationId: 99, supportingDocumentOther: '' }

describe('DocumentsModellingStep (simplified upload — #4669)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDocs = []
  })
  afterEach(cleanup)

  it('renders a single upload control, description input, and Save/Delete', () => {
    render(
      <DocumentsModellingStep
        ciApplication={baseCi}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.getByTestId('ci-step3-upload-supporting')).toBeInTheDocument()
    // The separate GHGenius upload control was removed by the simplification.
    expect(
      screen.queryByTestId('ci-step3-upload-ghgenius')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('ci-step3-guidance')).toBeInTheDocument()
    expect(screen.getByTestId('ci-step3-other-description')).toBeInTheDocument()
    expect(screen.getByTestId('ci-step3-save-btn')).toBeInTheDocument()
    expect(screen.getByTestId('ci-step3-delete-btn')).toBeInTheDocument()
  })

  it('hides the uploaded-documents list until a document exists', () => {
    render(<DocumentsModellingStep ciApplication={baseCi} onSave={vi.fn()} />, {
      wrapper
    })
    expect(
      screen.queryByTestId('ci-step3-uploaded-list')
    ).not.toBeInTheDocument()
  })

  it('shows the uploaded-documents list once a document exists', () => {
    mockDocs = [
      {
        documentId: 1,
        fileName: 'tech.pdf',
        fileSize: 100,
        documentCategory: 'supporting'
      }
    ]
    render(<DocumentsModellingStep ciApplication={baseCi} onSave={vi.fn()} />, {
      wrapper
    })
    expect(screen.getByTestId('ci-step3-uploaded-list')).toBeInTheDocument()
    expect(screen.getByTestId('ci-step3-uploaded-row')).toBeInTheDocument()
  })

  it('downloads the document when its file name is clicked (#4645)', () => {
    mockDocs = [
      {
        documentId: 7,
        fileName: 'tech.pdf',
        fileSize: 100,
        documentCategory: 'supporting'
      }
    ]
    render(<DocumentsModellingStep ciApplication={baseCi} onSave={vi.fn()} />, {
      wrapper
    })
    fireEvent.click(screen.getByTestId('ci-step3-download-doc'))
    expect(mockDownloadDoc).toHaveBeenCalledWith(7, 'tech.pdf')
  })

  it('allows Save & proceed with no uploads (required-doc validation disabled)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <DocumentsModellingStep
        ciApplication={{ ...baseCi, supportingDocumentOther: 'CCS notes' }}
        onSave={onSave}
      />,
      { wrapper }
    )
    const btn = screen.getByTestId('ci-step3-save-btn')
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].supportingDocumentOther).toBe('CCS notes')
  })

  it('uploads a chosen file under the generic supporting category', async () => {
    render(<DocumentsModellingStep ciApplication={baseCi} onSave={vi.fn()} />, {
      wrapper
    })
    const file = new File(['hi'], 'tech.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByTestId('ci-step3-supporting-input'), {
      target: { files: [file] }
    })
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1))
    expect(mockUpload.mock.calls[0][0].documentCategory).toBe('supporting')
  })

  it('rejects an unsupported file type without calling upload', async () => {
    render(<DocumentsModellingStep ciApplication={baseCi} onSave={vi.fn()} />, {
      wrapper
    })
    const file = new File(['hi'], 'bad.exe', {
      type: 'application/x-msdownload'
    })
    fireEvent.change(screen.getByTestId('ci-step3-supporting-input'), {
      target: { files: [file] }
    })
    // Shared validateFile utility surfaces "File type ... is not allowed".
    await waitFor(() =>
      expect(screen.getByText(/is not allowed/i)).toBeInTheDocument()
    )
    expect(mockUpload).not.toHaveBeenCalled()
  })
})
