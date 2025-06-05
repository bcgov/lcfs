import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'

import {
  useDeleteDocument,
  useUploadDocument,
  useDocuments
} from '@/hooks/useDocuments'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { validateFile } from '@/utils/fileValidation'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock hooks
vi.mock('@/hooks/useDocuments', () => ({
  useDocuments: vi.fn(),
  useDeleteDocument: vi.fn(),
  useUploadDocument: vi.fn(),
  useDownloadDocument: vi.fn()
}))
vi.mock('@/hooks/useCurrentUser')

// Mock constants
vi.mock('@/constants/common', () => ({
  MAX_FILE_SIZE_BYTES: 52428800, // 50MB
  COMPLIANCE_REPORT_FILE_TYPES: {
    ACCEPT_STRING: '.pdf,.doc,.docx,.xls,.xlsx,.txt'
  }
}))

// Mock file validation utility
vi.mock('@/utils/fileValidation', () => ({
  validateFile: vi.fn(() => ({ isValid: true }))
}))

// Mock formatters
vi.mock('@/utils/formatters', () => ({
  timezoneFormatter: vi.fn(({ value }) => value)
}))

// Mock pretty-bytes
vi.mock('pretty-bytes', () => ({
  default: vi.fn((bytes) => `${bytes} bytes`)
}))

// Mock components
vi.mock('@/components/BCModal', () => ({
  default: ({ children, data, ...props }) => (
    <div data-testid="bc-modal" {...props}>
      {data?.title && <h2>{data.title}</h2>}
      {data?.content}
      {children}
    </div>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => <span {...props}>{children}</span>
}))

describe('DocumentUploadDialog', () => {
  const parentID = '123'
  const closeMock = vi.fn()

  beforeEach(() => {
    // Mock the hooks with initial values
    useDocuments.mockReturnValue({
      data: [],
      isLoading: false
    })
    useUploadDocument.mockReturnValue({
      mutate: vi.fn()
    })
    useDeleteDocument.mockReturnValue({
      mutate: vi.fn()
    })
    useCurrentUser.mockReturnValue({
      data: { keycloakUsername: 'tester' },
      hasRoles: vi.fn(() => false),
      hasAnyRole: vi.fn(() => false)
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
        parentType="report"
        parentID={parentID}
      />,
      { wrapper }
    )
    expect(screen.getByText('report:documentLabel')).toBeInTheDocument()
  })

  it('opens file input when card is clicked', () => {
    render(
      <DocumentUploadDialog
        open={true}
        close={closeMock}
        parentType="report"
        parentID={parentID}
      />,
      { wrapper }
    )
    const card = screen.getByRole('button', { name: /upload/i })
    fireEvent.click(card)
    const fileInput = screen.getByTestId('file-input')
    expect(fileInput).toBeInTheDocument()
  })

  it('handles file upload', async () => {
    const uploadFileMock = vi.fn((file, callbacks) => {
      // Simulate successful upload by calling onSuccess callback
      if (callbacks && callbacks.onSuccess) {
        setTimeout(() => callbacks.onSuccess(), 0)
      }
    })
    useUploadDocument.mockReturnValue({
      mutate: uploadFileMock
    })

    render(
      <DocumentUploadDialog
        open={true}
        close={closeMock}
        parentType="report"
        parentID={parentID}
      />,
      { wrapper }
    )
    const fileInput = screen.getByTestId('file-input')

    const file = new File(['dummy content'], 'example.txt', {
      type: 'text/plain'
    })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(uploadFileMock).toHaveBeenCalledWith(file, expect.any(Object))
    })
  })

  it('handles file deletion', async () => {
    const deleteFileMock = vi.fn()
    useDeleteDocument.mockReturnValue({
      mutate: deleteFileMock
    })

    useDocuments.mockReturnValue({
      data: [
        {
          documentId: '1',
          fileName: 'example.txt',
          fileSize: 1024,
          createUser: 'tester',
          createDate: '2024-01-01T00:00:00Z'
        }
      ],
      isLoading: false
    })

    render(
      <DocumentUploadDialog
        open={true}
        close={closeMock}
        parentType="report"
        parentID={parentID}
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
    const uploadFileMock = vi.fn((file, callbacks) => {
      // Simulate successful upload by calling onSuccess callback
      if (callbacks && callbacks.onSuccess) {
        setTimeout(() => callbacks.onSuccess(), 0)
      }
    })
    useUploadDocument.mockReturnValue({
      mutate: uploadFileMock
    })

    render(
      <DocumentUploadDialog
        open={true}
        close={closeMock}
        parentType="report"
        parentID={parentID}
      />,
      { wrapper }
    )

    // The drag zone is the div that contains the upload icon button
    // We'll target it by finding the text that indicates drag and drop
    const dragZone = screen.getByText('report:clickDrag').closest('div')

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

    fireEvent.dragEnter(dragZone, { dataTransfer })
    fireEvent.drop(dragZone, { dataTransfer })

    await waitFor(() => {
      expect(uploadFileMock).toHaveBeenCalledWith(file, expect.any(Object))
    })
  })

  describe('File validation', () => {
    it('should accept valid PDF file', async () => {
      const uploadFileMock = vi.fn((file, callbacks) => {
        if (callbacks && callbacks.onSuccess) {
          setTimeout(() => callbacks.onSuccess(), 0)
        }
      })
      useUploadDocument.mockReturnValue({
        mutate: uploadFileMock
      })

      // Mock validation to return valid
      validateFile.mockReturnValue({
        isValid: true,
        errorMessage: null
      })

      render(
        <DocumentUploadDialog
          open={true}
          close={closeMock}
          parentType="report"
          parentID={parentID}
        />,
        { wrapper }
      )

      const fileInput = screen.getByTestId('file-input')
      const validFile = new File(['pdf content'], 'document.pdf', {
        type: 'application/pdf'
      })

      fireEvent.change(fileInput, { target: { files: [validFile] } })

      await waitFor(() => {
        expect(uploadFileMock).toHaveBeenCalledWith(
          validFile,
          expect.any(Object)
        )
      })
    })

    it('should accept valid Excel file', async () => {
      const uploadFileMock = vi.fn((file, callbacks) => {
        if (callbacks && callbacks.onSuccess) {
          setTimeout(() => callbacks.onSuccess(), 0)
        }
      })
      useUploadDocument.mockReturnValue({
        mutate: uploadFileMock
      })

      // Mock validation to return valid
      validateFile.mockReturnValue({
        isValid: true,
        errorMessage: null
      })

      render(
        <DocumentUploadDialog
          open={true}
          close={closeMock}
          parentType="report"
          parentID={parentID}
        />,
        { wrapper }
      )

      const fileInput = screen.getByTestId('file-input')
      const validFile = new File(['excel content'], 'spreadsheet.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })

      fireEvent.change(fileInput, { target: { files: [validFile] } })

      await waitFor(() => {
        expect(uploadFileMock).toHaveBeenCalledWith(
          validFile,
          expect.any(Object)
        )
      })
    })
  })
})
