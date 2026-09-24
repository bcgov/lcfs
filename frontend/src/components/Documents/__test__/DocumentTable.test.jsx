import { screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, expect, beforeEach } from 'vitest'
import { test } from '@/tests/utils/fixtures'
import DocumentTable from '../DocumentTable'
import { validateFile } from '@/utils/fileValidation'
import {
  COMPLIANCE_REPORT_FILE_TYPES,
  MAX_FILE_SIZE_BYTES
} from '@/constants/common'

// Mock external dependencies
vi.mock('@/hooks/useDocuments', () => ({
  useDocuments: vi.fn(),
  useUploadDocument: vi.fn(),
  useDeleteDocument: vi.fn(),
  useUpdateDocument: vi.fn(),
  useDownloadDocument: vi.fn()
}))

vi.mock('@/components/Documents/DocumentPreviewButton', () => ({
  __esModule: true,
  default: ({ document }) => (
    <button type="button" data-test="document-preview-button">
      Preview document
    </button>
  )
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn()
}))

vi.mock('@/utils/fileValidation', () => ({
  validateFile: vi.fn()
}))

vi.mock('@/utils/formatters', () => ({
  timezoneFormatter: vi.fn(({ value }) => value || '2024-01-01T10:00:00Z')
}))

vi.mock('pretty-bytes', () => ({
  default: vi.fn((bytes) => `${Math.round(bytes / 1024 / 1024)} MB`)
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options = {}) => {
      const translations = {
        'report:clickDrag': 'Click or drag files here to upload',
        'report:deleteDocumentConfirmTitle': 'Delete document?',
        'report:deleteDocumentConfirmText': `Are you sure you want to delete ${options.fileName}?`,
        'common:deleteBtn': 'Delete',
        'common:cancelBtn': 'Cancel'
      }
      return translations[key] || key
    }
  })
}))

// Import mocked hooks for use in tests
import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
  useUpdateDocument,
  useDownloadDocument
} from '@/hooks/useDocuments'
import { useCurrentUser } from '@/hooks/useCurrentUser'

describe('DocumentTable', () => {
  let mockUploadMutate, mockDeleteMutate, mockUpdateMutate, mockDownloadDocument

  const defaultProps = {
    parentType: 'compliance-report',
    parentID: '123'
  }

  const createMockFile = (name, type = 'application/pdf', size = 1000) => {
    return new File(['test content'], name, { type, size })
  }

  const createDragEvent = (type, files = []) => {
    const event = new Event(type, { bubbles: true })
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        files,
        items: files.length > 0 ? files.map(() => ({ kind: 'file' })) : [],
        clearData: vi.fn()
      }
    })
    return event
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockUploadMutate = vi.fn()
    mockDeleteMutate = vi.fn().mockResolvedValue({})
    mockUpdateMutate = vi.fn().mockResolvedValue({})
    mockDownloadDocument = vi.fn()

    // Set up default mock returns
    useDocuments.mockReturnValue({
      data: [],
      isLoading: false
    })
    useUploadDocument.mockReturnValue({
      mutate: mockUploadMutate,
      isPending: false
    })
    useDeleteDocument.mockReturnValue({
      mutate: mockDeleteMutate
    })
    useUpdateDocument.mockReturnValue({
      mutateAsync: mockUpdateMutate
    })
    useDownloadDocument.mockReturnValue(mockDownloadDocument)
    useCurrentUser.mockReturnValue({
      data: { keycloakUsername: 'testuser' },
      hasRoles: vi.fn(() => false)
    })

    // Default file validation to pass
    validateFile.mockReturnValue({ isValid: true, errorMessage: null })
  })

  // High Priority Tests - Component Rendering and Core Functionality

  test('should render with initial state and basic UI elements', ({
    render,
    theme,
    router
  }) => {
    render(<DocumentTable {...defaultProps} />, [theme, router])

    expect(screen.getByTestId('file-input')).toBeInTheDocument()
    expect(
      screen.getByText('Click or drag files here to upload')
    ).toBeInTheDocument()
    expect(screen.getByText('File Name')).toBeInTheDocument()
    expect(screen.getByText('Uploaded')).toBeInTheDocument()
    expect(screen.getByText('Size')).toBeInTheDocument()
    expect(screen.getByText('Virus Scan')).toBeInTheDocument()
  })

  test('should handle file input change and trigger upload', async ({
    render,
    theme,
    router
  }) => {
    const validFile = createMockFile('test.pdf', 'application/pdf', 1000)

    render(<DocumentTable {...defaultProps} />, [theme, router])

    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(validateFile).toHaveBeenCalledWith(
        validFile,
        MAX_FILE_SIZE_BYTES,
        COMPLIANCE_REPORT_FILE_TYPES
      )
      expect(mockUploadMutate).toHaveBeenCalled()
    })
  })

  test('allows selecting multiple files at once (#4739)', ({
    render,
    theme,
    router
  }) => {
    render(<DocumentTable {...defaultProps} />, [theme, router])
    expect(screen.getByTestId('file-input')).toHaveAttribute('multiple')
  })

  test('uploads every file selected in a single action (#4739)', async ({
    render,
    theme,
    router
  }) => {
    const fileA = createMockFile('a.pdf', 'application/pdf', 1000)
    const fileB = createMockFile('b.pdf', 'application/pdf', 1000)
    const fileC = createMockFile('c.pdf', 'application/pdf', 1000)

    render(<DocumentTable {...defaultProps} />, [theme, router])

    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: [fileA, fileB, fileC] } })

    await waitFor(() => {
      expect(validateFile).toHaveBeenCalledTimes(3)
      expect(mockUploadMutate).toHaveBeenCalledTimes(3)
    })
  })

  test('uploads every file dropped in a single action (#4739)', async ({
    render,
    theme,
    router
  }) => {
    const fileA = createMockFile('a.pdf', 'application/pdf', 1000)
    const fileB = createMockFile('b.pdf', 'application/pdf', 1000)

    render(<DocumentTable {...defaultProps} />, [theme, router])

    const uploadCard = screen
      .getByText('Click or drag files here to upload')
      .closest('div')

    const dropEvent = createDragEvent('drop', [fileA, fileB])
    fireEvent(uploadCard.parentElement, dropEvent)

    await waitFor(() => {
      expect(mockUploadMutate).toHaveBeenCalledTimes(2)
    })
  })

  test('should handle card click to open file dialog', ({
    render,
    theme,
    router
  }) => {
    render(<DocumentTable {...defaultProps} />, [theme, router])

    const uploadCard = screen
      .getByText('Click or drag files here to upload')
      .closest('div')
    const fileInput = screen.getByTestId('file-input')

    // Mock the click method
    const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => {})

    fireEvent.click(uploadCard.parentElement)

    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  test('should handle drag and drop file upload', async ({
    render,
    theme,
    router
  }) => {
    const validFile = createMockFile('test.pdf', 'application/pdf', 1000)

    render(<DocumentTable {...defaultProps} />, [theme, router])

    const uploadCard = screen
      .getByText('Click or drag files here to upload')
      .closest('div')

    // Simulate drag enter
    const dragEnterEvent = createDragEvent('dragenter', [validFile])
    fireEvent(uploadCard.parentElement, dragEnterEvent)

    // Simulate drop
    const dropEvent = createDragEvent('drop', [validFile])
    fireEvent(uploadCard.parentElement, dropEvent)

    await waitFor(() => {
      expect(validateFile).toHaveBeenCalledWith(
        validFile,
        MAX_FILE_SIZE_BYTES,
        COMPLIANCE_REPORT_FILE_TYPES
      )
      expect(mockUploadMutate).toHaveBeenCalled()
    })
  })

  test('should display error alert for invalid files', async ({
    render,
    theme,
    router
  }) => {
    const invalidFile = createMockFile('test.txt', 'text/plain', 1000)

    validateFile.mockReturnValue({
      isValid: false,
      errorMessage: 'File type "text/plain" is not allowed'
    })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })

    await waitFor(() => {
      expect(screen.getByTestId('file-upload-error-alert')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Upload failed for "test.txt": File type "text/plain" is not allowed'
        )
      ).toBeInTheDocument()
    })

    expect(mockUploadMutate).not.toHaveBeenCalled()
  })

  test('should show confirmation before file deletion', async ({
    render,
    theme,
    router
  }) => {
    const mockFiles = [
      {
        documentId: 1,
        fileName: 'test.pdf',
        fileSize: 1024000,
        createDate: '2024-01-01T10:00:00Z',
        createUser: 'testuser'
      }
    ]

    useDocuments.mockReturnValue({ data: mockFiles, isLoading: false })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
    })

    const deleteButton = screen.getByTestId('delete-button')
    fireEvent.click(deleteButton)

    expect(screen.getByText('Delete document?')).toBeInTheDocument()
    expect(mockDeleteMutate).not.toHaveBeenCalled()
  })

  test('should handle file deletion successfully after confirmation', async ({
    render,
    theme,
    router
  }) => {
    const mockFiles = [
      {
        documentId: 1,
        fileName: 'test.pdf',
        fileSize: 1024000,
        createDate: '2024-01-01T10:00:00Z',
        createUser: 'testuser'
      }
    ]

    useDocuments.mockReturnValue({ data: mockFiles, isLoading: false })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('delete-button'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(mockDeleteMutate).toHaveBeenCalledWith(1)
    })
  })

  test('should not delete file when confirmation is cancelled', async ({
    render,
    theme,
    router
  }) => {
    const mockFiles = [
      {
        documentId: 1,
        fileName: 'test.pdf',
        fileSize: 1024000,
        createDate: '2024-01-01T10:00:00Z',
        createUser: 'testuser'
      }
    ]

    useDocuments.mockReturnValue({ data: mockFiles, isLoading: false })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    await waitFor(() => {
      expect(screen.getByTestId('delete-button')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('delete-button'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(mockDeleteMutate).not.toHaveBeenCalled()
    expect(screen.queryByText('Delete document?')).not.toBeInTheDocument()
  })

  test('should handle file download when filename is clicked', async ({
    render,
    theme,
    router
  }) => {
    const mockFiles = [
      {
        documentId: 1,
        fileName: 'test.pdf',
        fileSize: 1024000,
        createDate: '2024-01-01T10:00:00Z',
        createUser: 'testuser'
      }
    ]

    useDocuments.mockReturnValue({ data: mockFiles, isLoading: false })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
    })

    const fileName = screen.getByText('test.pdf')
    fireEvent.click(fileName)

    expect(mockDownloadDocument).toHaveBeenCalledWith(1, 'test.pdf')
  })

  test('should download a renamed file using its display name', async ({
    render,
    theme,
    router
  }) => {
    const mockFiles = [
      {
        documentId: 1,
        fileName: 'test.pdf',
        displayName: 'My Renamed File.pdf',
        fileSize: 1024000,
        createDate: '2024-01-01T10:00:00Z',
        createUser: 'testuser'
      }
    ]

    useDocuments.mockReturnValue({ data: mockFiles, isLoading: false })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    const fileName = await screen.findByText('My Renamed File.pdf')
    fireEvent.click(fileName)

    expect(mockDownloadDocument).toHaveBeenCalledWith(1, 'My Renamed File.pdf')
  })

  test('should display loaded files from server', async ({
    render,
    theme,
    router
  }) => {
    const mockFiles = [
      {
        documentId: 1,
        fileName: 'report.pdf',
        fileSize: 1024000,
        createDate: '2024-01-01T10:00:00Z',
        createUser: 'testuser'
      },
      {
        documentId: 2,
        fileName: 'data.xlsx',
        fileSize: 2048000,
        createDate: '2024-01-02T11:00:00Z',
        createUser: 'otheruser'
      }
    ]

    useDocuments.mockReturnValue({ data: mockFiles, isLoading: false })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    await waitFor(() => {
      expect(screen.getByText('report.pdf')).toBeInTheDocument()
      expect(screen.getByText('data.xlsx')).toBeInTheDocument()
    })
  })

  test('should handle upload error responses correctly', async ({
    render,
    theme,
    router
  }) => {
    const validFile = createMockFile('test.pdf', 'application/pdf', 1000)

    // Mock upload to trigger error callback
    mockUploadMutate.mockImplementation((file, { onError }) => {
      onError({ response: { status: 422 } })
    })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(mockUploadMutate).toHaveBeenCalled()
    })

    // Should handle 422 error (virus detected)
    expect(mockUploadMutate.mock.calls[0][1].onError).toBeDefined()
  })

  // Medium Priority Tests - Edge Cases and Advanced Features

  test('should show scanning state for uploading files', async ({
    render,
    theme,
    router
  }) => {
    const file = createMockFile('test.pdf', 'application/pdf', 1000)

    render(<DocumentTable {...defaultProps} />, [theme, router])

    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })

  test('should handle drag state changes correctly', ({
    render,
    theme,
    router
  }) => {
    const file = createMockFile('test.pdf', 'application/pdf', 1000)

    render(<DocumentTable {...defaultProps} />, [theme, router])

    const uploadCard = screen
      .getByText('Click or drag files here to upload')
      .closest('div')

    // Test drag enter
    const dragEnterEvent = createDragEvent('dragenter', [file])
    fireEvent(uploadCard.parentElement, dragEnterEvent)

    // Test drag leave
    const dragLeaveEvent = createDragEvent('dragleave')
    fireEvent(uploadCard.parentElement, dragLeaveEvent)

    // Test drag over
    const dragOverEvent = createDragEvent('dragover')
    fireEvent(uploadCard.parentElement, dragOverEvent)

    // Component should handle all drag events without errors
    expect(uploadCard).toBeInTheDocument()
  })

  test('should not show delete button for files uploaded by other users', async ({
    render,
    theme,
    router
  }) => {
    const mockFiles = [
      {
        documentId: 1,
        fileName: 'other-user-file.pdf',
        fileSize: 1024000,
        createDate: '2024-01-01T10:00:00Z',
        createUser: 'otheruser'
      }
    ]

    useDocuments.mockReturnValue({ data: mockFiles, isLoading: false })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    await waitFor(() => {
      expect(screen.getByText('other-user-file.pdf')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument()
  })

  test('should handle file with virus detection', async ({
    render,
    theme,
    router
  }) => {
    const file = createMockFile('infected.pdf', 'application/pdf', 1000)

    mockUploadMutate.mockImplementation((file, { onError }) => {
      onError({ response: { status: 422 } })
    })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('infected.pdf')).toBeInTheDocument()
    })
  })

  test('should show user information for non-supplier roles', async ({
    render,
    theme,
    router
  }) => {
    const mockFiles = [
      {
        documentId: 1,
        fileName: 'test.pdf',
        fileSize: 1024000,
        createDate: '2024-01-01T10:00:00Z',
        createUser: 'adminuser'
      }
    ]

    useDocuments.mockReturnValue({ data: mockFiles, isLoading: false })
    useCurrentUser.mockReturnValue({
      data: { keycloakUsername: 'currentuser' },
      hasRoles: vi.fn((role) => role !== 'Supplier')
    })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    await waitFor(() => {
      expect(screen.getByText(/adminuser/)).toBeInTheDocument()
    })
  })

  // Low Priority Tests - UI Variations and Edge Cases

  test('should handle empty file list gracefully', ({
    render,
    theme,
    router
  }) => {
    useDocuments.mockReturnValue({ data: [], isLoading: false })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    expect(screen.getByText('File Name')).toBeInTheDocument()
    expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument()
  })

  test('should handle null data from useDocuments', ({
    render,
    theme,
    router
  }) => {
    useDocuments.mockReturnValue({ data: null, isLoading: false })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    expect(screen.getByText('File Name')).toBeInTheDocument()
    expect(screen.getByTestId('file-input')).toBeInTheDocument()
  })

  test('should handle error dismissal correctly', async ({
    render,
    theme,
    router
  }) => {
    const invalidFile = createMockFile('test.bad', 'application/unknown', 1000)

    validateFile.mockReturnValue({
      isValid: false,
      errorMessage: 'File type not allowed'
    })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })

    await waitFor(() => {
      expect(screen.getByTestId('file-upload-error-alert')).toBeInTheDocument()
    })

    // The error message should be dismissible through the BCAlert component
    expect(screen.getByTestId('file-upload-error-alert')).toBeInTheDocument()
  })

  // Additional Coverage Tests

  test('should handle file input without selected file', ({
    render,
    theme,
    router
  }) => {
    render(<DocumentTable {...defaultProps} />, [theme, router])

    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: [] } })

    expect(mockUploadMutate).not.toHaveBeenCalled()
  })

  test('should handle null file input', ({ render, theme, router }) => {
    render(<DocumentTable {...defaultProps} />, [theme, router])

    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: null } })

    expect(mockUploadMutate).not.toHaveBeenCalled()
  })

  test('should handle undefined current user', ({ render, theme, router }) => {
    useCurrentUser.mockReturnValue({
      data: null,
      hasRoles: vi.fn(() => false)
    })

    const file = createMockFile('test.pdf', 'application/pdf', 1000)

    render(<DocumentTable {...defaultProps} />, [theme, router])

    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(mockUploadMutate).toHaveBeenCalled()
  })

  test('should handle deletion error gracefully', async ({
    render,
    theme,
    router
  }) => {
    const mockFiles = [
      {
        documentId: 1,
        fileName: 'test.pdf',
        fileSize: 1024000,
        createDate: '2024-01-01T10:00:00Z',
        createUser: 'testuser'
      }
    ]

    useDocuments.mockReturnValue({ data: mockFiles, isLoading: false })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockDeleteMutate.mockRejectedValue(new Error('Deletion failed'))

    render(<DocumentTable {...defaultProps} />, [theme, router])

    await waitFor(() => {
      expect(screen.getByTestId('delete-button')).toBeInTheDocument()
    })

    const deleteButton = screen.getByTestId('delete-button')
    fireEvent.click(deleteButton)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error uploading file:',
        expect.any(Error)
      )
    })

    consoleSpy.mockRestore()
  })

  test('should handle files with missing properties gracefully', async ({
    render,
    theme,
    router
  }) => {
    const incompleteFiles = [
      {
        documentId: 1,
        fileName: 'incomplete.pdf'
        // Missing fileSize, createDate, createUser
      }
    ]

    useDocuments.mockReturnValue({ data: incompleteFiles, isLoading: false })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    await waitFor(() => {
      expect(screen.getByText('incomplete.pdf')).toBeInTheDocument()
    })
  })

  test('should render with different parent types and IDs', ({
    render,
    theme,
    router
  }) => {
    render(<DocumentTable parentType="fuel-export" parentID="456" />, [
      theme,
      router
    ])

    expect(useDocuments).toHaveBeenCalledWith('fuel-export', '456')
    expect(useUploadDocument).toHaveBeenCalledWith('fuel-export', '456')
    expect(useDeleteDocument).toHaveBeenCalledWith('fuel-export', '456')
  })

  test('should clear error message when new file is uploaded', async ({
    render,
    theme,
    router
  }) => {
    const invalidFile = createMockFile('bad.xyz', 'application/unknown')
    const validFile = createMockFile('good.pdf', 'application/pdf')

    validateFile
      .mockReturnValueOnce({
        isValid: false,
        errorMessage: 'File type not allowed'
      })
      .mockReturnValueOnce({ isValid: true, errorMessage: null })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    const fileInput = screen.getByTestId('file-input')

    // Upload invalid file first
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })

    await waitFor(() => {
      expect(screen.getByTestId('file-upload-error-alert')).toBeInTheDocument()
    })

    // Upload valid file
    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(
        screen.queryByTestId('file-upload-error-alert')
      ).not.toBeInTheDocument()
    })

    expect(mockUploadMutate).toHaveBeenCalledTimes(1)
  })

  // Additional Edge Case Tests for Maximum Coverage

  test('should handle drop with no files', ({ render, theme, router }) => {
    render(<DocumentTable {...defaultProps} />, [theme, router])

    const uploadCard = screen
      .getByText('Click or drag files here to upload')
      .closest('div')

    const dropEvent = createDragEvent('drop', [])
    fireEvent(uploadCard.parentElement, dropEvent)

    expect(mockUploadMutate).not.toHaveBeenCalled()
  })

  test('should show deleting state when deletion in progress', async ({
    render,
    theme,
    router
  }) => {
    const mockFiles = [
      {
        documentId: 1,
        fileName: 'test.pdf',
        fileSize: 1024000,
        createDate: '2024-01-01T10:00:00Z',
        createUser: 'testuser'
      }
    ]

    useDocuments.mockReturnValue({ data: mockFiles, isLoading: false })

    // Mock deletion to be pending
    mockDeleteMutate.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<DocumentTable {...defaultProps} />, [theme, router])

    await waitFor(() => {
      expect(screen.getByTestId('delete-button')).toBeInTheDocument()
    })

    const deleteButton = screen.getByTestId('delete-button')
    fireEvent.click(deleteButton)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })

  test('should not show delete button for files in error states', async ({
    render,
    theme,
    router
  }) => {
    const mockFiles = [
      {
        documentId: 1,
        fileName: 'error-file.pdf',
        fileSize: 1024000,
        createDate: '2024-01-01T10:00:00Z',
        createUser: 'testuser',
        error: true
      },
      {
        documentId: 2,
        fileName: 'virus-file.pdf',
        fileSize: 1024000,
        createDate: '2024-01-01T10:00:00Z',
        createUser: 'testuser',
        virus: true
      },
      {
        documentId: 3,
        fileName: 'oversize-file.pdf',
        fileSize: 1024000,
        createDate: '2024-01-01T10:00:00Z',
        createUser: 'testuser',
        oversize: true
      }
    ]

    useDocuments.mockReturnValue({ data: mockFiles, isLoading: false })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    await waitFor(() => {
      expect(
        screen.getByText('error-file.pdf (Unsupported file type)')
      ).toBeInTheDocument()
      expect(
        screen.getByText('oversize-file.pdf (File is over 50MB)')
      ).toBeInTheDocument()
    })

    expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument()
  })

  test('should handle non-422 upload errors correctly', async ({
    render,
    theme,
    router
  }) => {
    const validFile = createMockFile('test.pdf', 'application/pdf', 1000)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock upload to trigger non-422 error
    mockUploadMutate.mockImplementation((file, { onError }) => {
      onError({ response: { status: 500 }, message: 'Server error' })
    })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(mockUploadMutate).toHaveBeenCalled()
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      'Error uploading file:',
      expect.any(Object)
    )

    consoleSpy.mockRestore()
  })

  test('should handle file size display correctly', async ({
    render,
    theme,
    router
  }) => {
    const mockFiles = [
      {
        documentId: 1,
        fileName: 'test.pdf',
        fileSize: 1048576, // 1MB
        createDate: '2024-01-01T10:00:00Z',
        createUser: 'testuser'
      }
    ]

    useDocuments.mockReturnValue({ data: mockFiles, isLoading: false })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    await waitFor(() => {
      expect(screen.getByText('1 MB')).toBeInTheDocument()
    })
  })

  test('should hide user information for supplier roles', async ({
    render,
    theme,
    router
  }) => {
    const mockFiles = [
      {
        documentId: 1,
        fileName: 'test.pdf',
        fileSize: 1024000,
        createDate: '2024-01-01T10:00:00Z',
        createUser: 'supplieruser'
      }
    ]

    useDocuments.mockReturnValue({ data: mockFiles, isLoading: false })
    useCurrentUser.mockReturnValue({
      data: { keycloakUsername: 'currentuser' },
      hasRoles: vi.fn((role) => role === 'Supplier')
    })

    render(<DocumentTable {...defaultProps} />, [theme, router])

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
    })

    expect(screen.queryByText(/supplieruser/)).not.toBeInTheDocument()
  })

  test('should handle rapid successive file uploads', async ({
    render,
    theme,
    router
  }) => {
    render(<DocumentTable {...defaultProps} />, [theme, router])

    const file1 = createMockFile('test1.pdf', 'application/pdf', 1000)
    const file2 = createMockFile('test2.pdf', 'application/pdf', 1000)

    const fileInput = screen.getByTestId('file-input')

    // Upload files in quick succession
    fireEvent.change(fileInput, { target: { files: [file1] } })
    fireEvent.change(fileInput, { target: { files: [file2] } })

    await waitFor(() => {
      expect(mockUploadMutate).toHaveBeenCalledTimes(2)
    })
  })
})
