import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import DocumentTable from '@/components/Documents/DocumentTable'
import { validateFile } from '@/utils/fileValidation'
import {
  COMPLIANCE_REPORT_FILE_TYPES,
  MAX_FILE_SIZE_BYTES
} from '@/constants/common'

import {
  useDeleteDocument,
  useUploadDocument,
  useDocuments
} from '@/hooks/useDocuments'
import { useCurrentUser } from '@/hooks/useCurrentUser'

// Mock hooks
vi.mock('@/hooks/useDocuments', () => ({
  useDocuments: vi.fn(),
  useDeleteDocument: vi.fn(),
  useUploadDocument: vi.fn(),
  useDownloadDocument: vi.fn()
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn()
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock formatters
vi.mock('@/utils/formatters', () => ({
  timezoneFormatter: vi.fn(({ value }) => value)
}))

// Mock pretty-bytes
vi.mock('pretty-bytes', () => ({
  default: vi.fn((bytes) => `${Math.round(bytes / 1024 / 1024)} MB`)
}))

// Mock file validation utility
vi.mock('@/utils/fileValidation')

describe('DocumentTable File Validation', () => {
  let mockUploadMutate, mockDeleteMutate

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    mockUploadMutate = vi.fn()
    mockDeleteMutate = vi.fn()

    // Mock the hooks with initial values
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
    useCurrentUser.mockReturnValue({
      data: { keycloakUsername: 'tester' },
      hasRoles: vi.fn(() => false),
      hasAnyRole: vi.fn(() => false)
    })

    // Default validation to pass
    validateFile.mockReturnValue({ isValid: true, errorMessage: null })
  })

  const createMockFile = (name, type, size = 1000) => {
    return new File(['test content'], name, { type, size })
  }

  it('should accept valid PDF file', async () => {
    const validFile = createMockFile('test.pdf', 'application/pdf', 1000)

    validateFile.mockReturnValue({ isValid: true, errorMessage: null })

    render(<DocumentTable parentType="report" parentID={1} />, { wrapper })

    const fileInput = screen.getByTestId('file-input')

    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(validateFile).toHaveBeenCalledWith(
        validFile,
        MAX_FILE_SIZE_BYTES,
        COMPLIANCE_REPORT_FILE_TYPES
      )
    })

    expect(mockUploadMutate).toHaveBeenCalled()
  })

  it('should accept valid Excel file', async () => {
    const excelFile = createMockFile(
      'data.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      5000
    )

    validateFile.mockReturnValue({ isValid: true, errorMessage: null })

    render(<DocumentTable parentType="report" parentID={1} />, { wrapper })

    const fileInput = screen.getByTestId('file-input')

    fireEvent.change(fileInput, { target: { files: [excelFile] } })

    await waitFor(() => {
      expect(validateFile).toHaveBeenCalledWith(
        excelFile,
        MAX_FILE_SIZE_BYTES,
        COMPLIANCE_REPORT_FILE_TYPES
      )
    })

    expect(mockUploadMutate).toHaveBeenCalled()
  })

  it('should accept valid Word document', async () => {
    const wordFile = createMockFile(
      'document.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      3000
    )

    validateFile.mockReturnValue({ isValid: true, errorMessage: null })

    render(<DocumentTable parentType="report" parentID={1} />, { wrapper })

    const fileInput = screen.getByTestId('file-input')

    fireEvent.change(fileInput, { target: { files: [wordFile] } })

    await waitFor(() => {
      expect(validateFile).toHaveBeenCalledWith(
        wordFile,
        MAX_FILE_SIZE_BYTES,
        COMPLIANCE_REPORT_FILE_TYPES
      )
    })

    expect(mockUploadMutate).toHaveBeenCalled()
  })

  it('should accept valid image file', async () => {
    const imageFile = createMockFile('image.png', 'image/png', 2000)

    validateFile.mockReturnValue({ isValid: true, errorMessage: null })

    render(<DocumentTable parentType="report" parentID={1} />, { wrapper })

    const fileInput = screen.getByTestId('file-input')

    fireEvent.change(fileInput, { target: { files: [imageFile] } })

    await waitFor(() => {
      expect(validateFile).toHaveBeenCalledWith(
        imageFile,
        MAX_FILE_SIZE_BYTES,
        COMPLIANCE_REPORT_FILE_TYPES
      )
    })

    expect(mockUploadMutate).toHaveBeenCalled()
  })

  it('should handle multiple files with mixed validation results', async () => {
    const validFile = createMockFile('valid.pdf', 'application/pdf', 1000)
    const invalidFile = createMockFile('invalid.txt', 'text/plain', 1000)

    // Mock validation to return different results for different files
    validateFile
      .mockReturnValueOnce({ isValid: true, errorMessage: null })
      .mockReturnValueOnce({
        isValid: false,
        errorMessage: 'File type "text/plain" is not allowed'
      })

    render(<DocumentTable parentType="report" parentID={1} />, { wrapper })

    const fileInput = screen.getByTestId('file-input')

    // First file (valid)
    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(validateFile).toHaveBeenCalledWith(
        validFile,
        MAX_FILE_SIZE_BYTES,
        COMPLIANCE_REPORT_FILE_TYPES
      )
    })

    // Second file (invalid)
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })

    await waitFor(() => {
      expect(validateFile).toHaveBeenCalledWith(
        invalidFile,
        MAX_FILE_SIZE_BYTES,
        COMPLIANCE_REPORT_FILE_TYPES
      )
    })

    // Upload should be called only once for the valid file
    expect(mockUploadMutate).toHaveBeenCalledTimes(1)
  })

  it('should have correct accept attribute on file input', () => {
    render(<DocumentTable parentType="report" parentID={1} />, { wrapper })

    const fileInput = screen.getByTestId('file-input')
    expect(fileInput).toHaveAttribute(
      'accept',
      COMPLIANCE_REPORT_FILE_TYPES.ACCEPT_STRING
    )
  })
})
