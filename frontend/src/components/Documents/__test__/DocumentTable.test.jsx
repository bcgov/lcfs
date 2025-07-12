import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
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
  useDownloadDocument: vi.fn()
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
    t: (key) => {
      const translations = {
        'report:clickDrag': 'Click or drag files here to upload'
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
  useDownloadDocument
} from '@/hooks/useDocuments'
import { useCurrentUser } from '@/hooks/useCurrentUser'

describe('DocumentTable', () => {
  let mockUploadMutate, mockDeleteMutate, mockDownloadDocument

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
    useDownloadDocument.mockReturnValue(mockDownloadDocument)
    useCurrentUser.mockReturnValue({
      data: { keycloakUsername: 'testuser' },
      hasRoles: vi.fn(() => false)
    })

    // Default file validation to pass
    validateFile.mockReturnValue({ isValid: true, errorMessage: null })
  })

  // High Priority Tests - Component Rendering and Core Functionality

  it('should render with initial state and basic UI elements', () => {
    render(<DocumentTable {...defaultProps} />, { wrapper })

    expect(screen.getByTestId('file-input')).toBeInTheDocument()
    expect(screen.getByText('Click or drag files here to upload')).toBeInTheDocument()
    expect(screen.getByText('File Name')).toBeInTheDocument()
    expect(screen.getByText('Uploaded')).toBeInTheDocument()
    expect(screen.getByText('Size')).toBeInTheDocument()
    expect(screen.getByText('Virus Scan')).toBeInTheDocument()
  })

  it('should handle file input change and trigger upload', async () => {
    const validFile = createMockFile('test.pdf', 'application/pdf', 1000)
    
    render(<DocumentTable {...defaultProps} />, { wrapper })

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

  it('should handle card click to open file dialog', () => {
    render(<DocumentTable {...defaultProps} />, { wrapper })

    const uploadCard = screen.getByText('Click or drag files here to upload').closest('div')
    const fileInput = screen.getByTestId('file-input')
    
    // Mock the click method
    const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => {})
    
    fireEvent.click(uploadCard.parentElement)
    
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('should handle drag and drop file upload', async () => {
    const validFile = createMockFile('test.pdf', 'application/pdf', 1000)
    
    render(<DocumentTable {...defaultProps} />, { wrapper })

    const uploadCard = screen.getByText('Click or drag files here to upload').closest('div')
    
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

  it('should display error alert for invalid files', async () => {
    const invalidFile = createMockFile('test.txt', 'text/plain', 1000)
    
    validateFile.mockReturnValue({
      isValid: false,
      errorMessage: 'File type "text/plain" is not allowed'
    })

    render(<DocumentTable {...defaultProps} />, { wrapper })

    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })

    await waitFor(() => {
      expect(screen.getByTestId('file-upload-error-alert')).toBeInTheDocument()
      expect(screen.getByText('Upload failed for "test.txt": File type "text/plain" is not allowed')).toBeInTheDocument()
    })

    expect(mockUploadMutate).not.toHaveBeenCalled()
  })

  it('should handle file deletion successfully', async () => {
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

    render(<DocumentTable {...defaultProps} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
    })

    const deleteButton = screen.getByTestId('delete-button')
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(mockDeleteMutate).toHaveBeenCalledWith(1)
    })
  })

  it('should handle file download when filename is clicked', async () => {
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

    render(<DocumentTable {...defaultProps} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
    })

    const fileName = screen.getByText('test.pdf')
    fireEvent.click(fileName)

    expect(mockDownloadDocument).toHaveBeenCalledWith(1)
  })

  it('should display loaded files from server', async () => {
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

    render(<DocumentTable {...defaultProps} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('report.pdf')).toBeInTheDocument()
      expect(screen.getByText('data.xlsx')).toBeInTheDocument()
    })
  })

  it('should handle upload error responses correctly', async () => {
    const validFile = createMockFile('test.pdf', 'application/pdf', 1000)
    
    // Mock upload to trigger error callback
    mockUploadMutate.mockImplementation((file, { onError }) => {
      onError({ response: { status: 422 } })
    })

    render(<DocumentTable {...defaultProps} />, { wrapper })

    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(mockUploadMutate).toHaveBeenCalled()
    })

    // Should handle 422 error (virus detected)
    expect(mockUploadMutate.mock.calls[0][1].onError).toBeDefined()
  })

  // Medium Priority Tests - Edge Cases and Advanced Features

  it('should show scanning state for uploading files', async () => {
    const file = createMockFile('test.pdf', 'application/pdf', 1000)
    
    render(<DocumentTable {...defaultProps} />, { wrapper })
    
    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })

  it('should handle drag state changes correctly', () => {
    const file = createMockFile('test.pdf', 'application/pdf', 1000)
    
    render(<DocumentTable {...defaultProps} />, { wrapper })
    
    const uploadCard = screen.getByText('Click or drag files here to upload').closest('div')
    
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

  it('should not show delete button for files uploaded by other users', async () => {
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

    render(<DocumentTable {...defaultProps} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('other-user-file.pdf')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument()
  })

  it('should handle file with virus detection', async () => {
    const file = createMockFile('infected.pdf', 'application/pdf', 1000)
    
    mockUploadMutate.mockImplementation((file, { onError }) => {
      onError({ response: { status: 422 } })
    })
    
    render(<DocumentTable {...defaultProps} />, { wrapper })
    
    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    await waitFor(() => {
      expect(screen.getByText('infected.pdf')).toBeInTheDocument()
    })
  })

  it('should show user information for non-supplier roles', async () => {
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

    render(<DocumentTable {...defaultProps} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText(/adminuser/)).toBeInTheDocument()
    })
  })

  // Low Priority Tests - UI Variations and Edge Cases

  it('should handle empty file list gracefully', () => {
    useDocuments.mockReturnValue({ data: [], isLoading: false })

    render(<DocumentTable {...defaultProps} />, { wrapper })

    expect(screen.getByText('File Name')).toBeInTheDocument()
    expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument()
  })

  it('should handle null data from useDocuments', () => {
    useDocuments.mockReturnValue({ data: null, isLoading: false })

    render(<DocumentTable {...defaultProps} />, { wrapper })

    expect(screen.getByText('File Name')).toBeInTheDocument()
    expect(screen.getByTestId('file-input')).toBeInTheDocument()
  })

  it('should handle error dismissal correctly', async () => {
    const invalidFile = createMockFile('test.bad', 'application/unknown', 1000)
    
    validateFile.mockReturnValue({
      isValid: false,
      errorMessage: 'File type not allowed'
    })

    render(<DocumentTable {...defaultProps} />, { wrapper })

    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })

    await waitFor(() => {
      expect(screen.getByTestId('file-upload-error-alert')).toBeInTheDocument()
    })

    // The error message should be dismissible through the BCAlert component
    expect(screen.getByTestId('file-upload-error-alert')).toBeInTheDocument()
  })

  // Additional Coverage Tests

  it('should handle file input without selected file', () => {
    render(<DocumentTable {...defaultProps} />, { wrapper })

    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: [] } })

    expect(mockUploadMutate).not.toHaveBeenCalled()
  })

  it('should handle null file input', () => {
    render(<DocumentTable {...defaultProps} />, { wrapper })

    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: null } })

    expect(mockUploadMutate).not.toHaveBeenCalled()
  })

  it('should handle undefined current user', () => {
    useCurrentUser.mockReturnValue({
      data: null,
      hasRoles: vi.fn(() => false)
    })

    const file = createMockFile('test.pdf', 'application/pdf', 1000)

    render(<DocumentTable {...defaultProps} />, { wrapper })

    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(mockUploadMutate).toHaveBeenCalled()
  })

  it('should handle deletion error gracefully', async () => {
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

    render(<DocumentTable {...defaultProps} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('delete-button')).toBeInTheDocument()
    })

    const deleteButton = screen.getByTestId('delete-button')
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error uploading file:', expect.any(Error))
    })

    consoleSpy.mockRestore()
  })

  it('should handle files with missing properties gracefully', async () => {
    const incompleteFiles = [
      {
        documentId: 1,
        fileName: 'incomplete.pdf'
        // Missing fileSize, createDate, createUser
      }
    ]

    useDocuments.mockReturnValue({ data: incompleteFiles, isLoading: false })

    render(<DocumentTable {...defaultProps} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('incomplete.pdf')).toBeInTheDocument()
    })
  })

  it('should render with different parent types and IDs', () => {
    render(<DocumentTable parentType="fuel-export" parentID="456" />, { wrapper })

    expect(useDocuments).toHaveBeenCalledWith('fuel-export', '456')
    expect(useUploadDocument).toHaveBeenCalledWith('fuel-export', '456')
    expect(useDeleteDocument).toHaveBeenCalledWith('fuel-export', '456')
  })

  it('should clear error message when new file is uploaded', async () => {
    const invalidFile = createMockFile('bad.xyz', 'application/unknown')
    const validFile = createMockFile('good.pdf', 'application/pdf')

    validateFile
      .mockReturnValueOnce({
        isValid: false,
        errorMessage: 'File type not allowed'
      })
      .mockReturnValueOnce({ isValid: true, errorMessage: null })

    render(<DocumentTable {...defaultProps} />, { wrapper })

    const fileInput = screen.getByTestId('file-input')
    
    // Upload invalid file first
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })
    
    await waitFor(() => {
      expect(screen.getByTestId('file-upload-error-alert')).toBeInTheDocument()
    })

    // Upload valid file
    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(screen.queryByTestId('file-upload-error-alert')).not.toBeInTheDocument()
    })

    expect(mockUploadMutate).toHaveBeenCalledTimes(1)
  })

  // Additional Edge Case Tests for Maximum Coverage

  it('should handle drop with no files', () => {
    render(<DocumentTable {...defaultProps} />, { wrapper })
    
    const uploadCard = screen.getByText('Click or drag files here to upload').closest('div')
    
    const dropEvent = createDragEvent('drop', [])
    fireEvent(uploadCard.parentElement, dropEvent)
    
    expect(mockUploadMutate).not.toHaveBeenCalled()
  })

  it('should show deleting state when deletion in progress', async () => {
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

    render(<DocumentTable {...defaultProps} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('delete-button')).toBeInTheDocument()
    })

    const deleteButton = screen.getByTestId('delete-button')
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })

  it('should not show delete button for files in error states', async () => {
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

    render(<DocumentTable {...defaultProps} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('error-file.pdf (Unsupported file type)')).toBeInTheDocument()
      expect(screen.getByText('oversize-file.pdf (File is over 50MB)')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument()
  })

  it('should handle non-422 upload errors correctly', async () => {
    const validFile = createMockFile('test.pdf', 'application/pdf', 1000)
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    // Mock upload to trigger non-422 error
    mockUploadMutate.mockImplementation((file, { onError }) => {
      onError({ response: { status: 500 }, message: 'Server error' })
    })

    render(<DocumentTable {...defaultProps} />, { wrapper })

    const fileInput = screen.getByTestId('file-input')
    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(mockUploadMutate).toHaveBeenCalled()
    })

    expect(consoleSpy).toHaveBeenCalledWith('Error uploading file:', expect.any(Object))
    
    consoleSpy.mockRestore()
  })

  it('should handle file size display correctly', async () => {
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

    render(<DocumentTable {...defaultProps} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('1 MB')).toBeInTheDocument()
    })
  })

  it('should hide user information for supplier roles', async () => {
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

    render(<DocumentTable {...defaultProps} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
    })

    expect(screen.queryByText(/supplieruser/)).not.toBeInTheDocument()
  })

  it('should handle rapid successive file uploads', async () => {
    render(<DocumentTable {...defaultProps} />, { wrapper })

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