import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import {
  useComplianceReportDocuments,
  useDeleteComplianceReportDocument,
  useUploadComplianceReportDocument
} from '@/hooks/useComplianceReports'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'

const keycloak = vi.hoisted(() => ({
  useKeycloak: vi.fn()
}))
vi.mock('@react-keycloak/web', () => keycloak)

// Mock hooks
vi.mock('@/hooks/useComplianceReports', () => ({
  useComplianceReportDocuments: vi.fn(),
  useDeleteComplianceReportDocument: vi.fn(),
  useUploadComplianceReportDocument: vi.fn()
}))

// Mock API service
vi.mock('@/services/useApiService', () => ({
  useApiService: vi.fn()
}))

describe('DocumentUploadDialog', () => {
  const reportID = '123'
  const closeMock = vi.fn()

  beforeEach(() => {
    useComplianceReportDocuments.mockReturnValue({
      data: [],
      isLoading: false
    })
    useUploadComplianceReportDocument.mockReturnValue({
      mutate: vi.fn()
    })
    useDeleteComplianceReportDocument.mockReturnValue({
      mutate: vi.fn()
    })
    useApiService.mockReturnValue({
      get: vi.fn((url) => {
        if (url.includes('1')) {
          return Promise.resolve({ data: { url: 'http://example.com/doc1' } })
        } else if (url.includes('2')) {
          return Promise.resolve({ data: { url: 'http://example.com/doc2' } })
        }
      })
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(
      <DocumentUploadDialog
        open={true}
        close={closeMock}
        reportID={reportID}
      />,
      { wrapper }
    )
    expect(
      screen.getByText('Add file attachments (maximum file size: 50 MB):')
    ).toBeInTheDocument()
  })

  it('opens file input when card is clicked', () => {
    render(
      <DocumentUploadDialog
        open={true}
        close={closeMock}
        reportID={reportID}
      />,
      { wrapper }
    )
    const card = screen.getByRole('button', { name: /upload/i })
    fireEvent.click(card)
    const fileInput = screen.getByTestId('file-input')
    expect(fileInput).toBeInTheDocument()
  })

  it('handles file upload', async () => {
    const uploadFileMock = vi.fn()
    useUploadComplianceReportDocument.mockReturnValue({
      mutate: uploadFileMock
    })

    render(
      <DocumentUploadDialog
        open={true}
        close={closeMock}
        reportID={reportID}
      />,
      { wrapper }
    )
    const fileInput = screen.getByTestId('file-input')

    const file = new File(['dummy content'], 'example.txt', {
      type: 'text/plain'
    })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(uploadFileMock).toHaveBeenCalledWith(file)
    })
  })

  it('handles file deletion', async () => {
    const deleteFileMock = vi.fn()
    useDeleteComplianceReportDocument.mockReturnValue({
      mutate: deleteFileMock
    })

    useComplianceReportDocuments.mockReturnValue({
      data: [
        {
          documentId: '1',
          fileName: 'example.txt',
          fileSize: 1024
        }
      ],
      isLoading: false
    })

    render(
      <DocumentUploadDialog
        open={true}
        close={closeMock}
        reportID={reportID}
      />,
      { wrapper }
    )
    const deleteButton = screen.getByTestId('delete-button')
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(deleteFileMock).toHaveBeenCalledWith('1')
    })
  })

  it('handles drag and drop', async () => {
    const uploadFileMock = vi.fn()
    useUploadComplianceReportDocument.mockReturnValue({
      mutate: uploadFileMock
    })

    render(
      <DocumentUploadDialog
        open={true}
        close={closeMock}
        reportID={reportID}
      />,
      { wrapper }
    )
    const card = screen.getByRole('button', { name: /upload/i })

    const file = new File(['dummy content'], 'example.txt', {
      type: 'text/plain'
    })
    const dataTransfer = {
      items: [
        {
          kind: 'file',
          type: file.type
        }
      ],
      files: [file],
      clearData: vi.fn()
    }

    fireEvent.dragEnter(card, { dataTransfer })
    fireEvent.drop(card, { dataTransfer })

    await waitFor(() => {
      expect(uploadFileMock).toHaveBeenCalledWith(file)
    })
  })
})
