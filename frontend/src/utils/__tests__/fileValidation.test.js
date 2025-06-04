import { describe, it, expect } from 'vitest'
import { validateFileMimeType, validateFile } from '../fileValidation'
import {
  COMPLIANCE_REPORT_FILE_TYPES,
  SCHEDULE_IMPORT_FILE_TYPES
} from '@/constants/common'

describe('fileValidation', () => {
  // Helper function to create a mock file
  const createMockFile = (name, type, size = 1000) => {
    // For testing, we'll create a mock File object with the exact size we want
    const file = new File(['test content'], name, { type })
    // Override the size property for testing purposes
    Object.defineProperty(file, 'size', {
      value: size,
      writable: false
    })
    return file
  }

  describe('validateFileMimeType', () => {
    it('should return valid for allowed PDF file', () => {
      const file = createMockFile('test.pdf', 'application/pdf')
      const result = validateFileMimeType(file, COMPLIANCE_REPORT_FILE_TYPES)

      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBe(null)
    })

    it('should return valid for allowed PNG file', () => {
      const file = createMockFile('test.png', 'image/png')
      const result = validateFileMimeType(file, COMPLIANCE_REPORT_FILE_TYPES)

      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBe(null)
    })

    it('should return valid for allowed JPEG file', () => {
      const file = createMockFile('test.jpg', 'image/jpeg')
      const result = validateFileMimeType(file, COMPLIANCE_REPORT_FILE_TYPES)

      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBe(null)
    })

    it('should return valid for allowed Word document (.doc)', () => {
      const file = createMockFile('test.doc', 'application/msword')
      const result = validateFileMimeType(file, COMPLIANCE_REPORT_FILE_TYPES)

      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBe(null)
    })

    it('should return valid for allowed Word document (.docx)', () => {
      const file = createMockFile(
        'test.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      const result = validateFileMimeType(file, COMPLIANCE_REPORT_FILE_TYPES)

      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBe(null)
    })

    it('should return valid for allowed Excel file (.xls)', () => {
      const file = createMockFile('test.xls', 'application/vnd.ms-excel')
      const result = validateFileMimeType(file, COMPLIANCE_REPORT_FILE_TYPES)

      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBe(null)
    })

    it('should return valid for allowed Excel file (.xlsx)', () => {
      const file = createMockFile(
        'test.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      const result = validateFileMimeType(file, COMPLIANCE_REPORT_FILE_TYPES)

      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBe(null)
    })

    it('should return valid for allowed CSV file', () => {
      const file = createMockFile('test.csv', 'text/csv')
      const result = validateFileMimeType(file, COMPLIANCE_REPORT_FILE_TYPES)

      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBe(null)
    })

    it('should return valid for allowed TXT file', () => {
      const file = createMockFile('test.txt', 'text/plain')
      const result = validateFileMimeType(file, COMPLIANCE_REPORT_FILE_TYPES)

      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBe(null)
    })

    it('should return valid for Excel file with schedule import types', () => {
      const file = createMockFile(
        'schedule.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      const result = validateFileMimeType(file, SCHEDULE_IMPORT_FILE_TYPES)

      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBe(null)
    })

    it('should return invalid for disallowed file type', () => {
      const file = createMockFile('test.exe', 'application/x-msdownload')
      const result = validateFileMimeType(file, COMPLIANCE_REPORT_FILE_TYPES)

      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain(
        'File type "application/x-msdownload" is not allowed'
      )
      expect(result.errorMessage).toContain(
        'PDF, PNG, JPG/JPEG, Word Documents (.doc/.docx), Excel Spreadsheets (.xls/.xlsx), CSV, TXT'
      )
    })

    it('should return invalid for unknown file type', () => {
      const file = createMockFile('test.unknown', '')
      const result = validateFileMimeType(file, COMPLIANCE_REPORT_FILE_TYPES)

      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain(
        'File type "unknown" is not allowed'
      )
    })

    it('should return invalid for null file', () => {
      const result = validateFileMimeType(null, COMPLIANCE_REPORT_FILE_TYPES)

      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('No file selected')
    })

    it('should return invalid for undefined file', () => {
      const result = validateFileMimeType(
        undefined,
        COMPLIANCE_REPORT_FILE_TYPES
      )

      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('No file selected')
    })

    it('should handle file with undefined type', () => {
      const file = createMockFile('test.unknown', undefined)
      const result = validateFileMimeType(file, COMPLIANCE_REPORT_FILE_TYPES)

      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain(
        'File type "unknown" is not allowed'
      )
    })

    it('should return invalid for PDF file with schedule import types (Excel only)', () => {
      const file = createMockFile('test.pdf', 'application/pdf')
      const result = validateFileMimeType(file, SCHEDULE_IMPORT_FILE_TYPES)

      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain(
        'File type "application/pdf" is not allowed'
      )
    })
  })

  describe('validateFile', () => {
    const maxSizeBytes = 52428800 // 50MB

    it('should return valid for allowed file type and size', () => {
      const file = createMockFile('test.pdf', 'application/pdf', 1000)
      const result = validateFile(
        file,
        maxSizeBytes,
        COMPLIANCE_REPORT_FILE_TYPES
      )

      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBe(null)
    })

    it('should return invalid for disallowed file type even with valid size', () => {
      const file = createMockFile('test.exe', 'application/x-msdownload', 1000)
      const result = validateFile(
        file,
        maxSizeBytes,
        COMPLIANCE_REPORT_FILE_TYPES
      )

      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain(
        'File type "application/x-msdownload" is not allowed'
      )
    })

    it('should return invalid for allowed file type but oversized file', () => {
      const oversizedFile = createMockFile(
        'test.pdf',
        'application/pdf',
        maxSizeBytes + 1
      )
      const result = validateFile(
        oversizedFile,
        maxSizeBytes,
        COMPLIANCE_REPORT_FILE_TYPES
      )

      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain(
        'File size exceeds the maximum limit of 50 MB'
      )
    })

    it('should return valid for file exactly at size limit', () => {
      const file = createMockFile('test.pdf', 'application/pdf', maxSizeBytes)
      const result = validateFile(
        file,
        maxSizeBytes,
        COMPLIANCE_REPORT_FILE_TYPES
      )

      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBe(null)
    })

    it('should handle different size limits correctly', () => {
      const smallLimit = 1024 // 1KB
      const file = createMockFile('test.pdf', 'application/pdf', 2048) // 2KB
      const result = validateFile(
        file,
        smallLimit,
        COMPLIANCE_REPORT_FILE_TYPES
      )

      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain(
        'File size exceeds the maximum limit of 0 MB'
      )
    })

    it('should prioritize MIME type validation over size validation', () => {
      const file = createMockFile(
        'test.exe',
        'application/x-msdownload',
        maxSizeBytes + 1
      )
      const result = validateFile(
        file,
        maxSizeBytes,
        COMPLIANCE_REPORT_FILE_TYPES
      )

      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain(
        'File type "application/x-msdownload" is not allowed'
      )
      expect(result.errorMessage).not.toContain('File size exceeds')
    })

    it('should handle zero-sized files', () => {
      const file = createMockFile('test.pdf', 'application/pdf', 0)
      const result = validateFile(
        file,
        maxSizeBytes,
        COMPLIANCE_REPORT_FILE_TYPES
      )

      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBe(null)
    })

    it('should return invalid for null file', () => {
      const result = validateFile(
        null,
        maxSizeBytes,
        COMPLIANCE_REPORT_FILE_TYPES
      )

      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('No file selected')
    })
  })

  describe('File type constants integration', () => {
    it('should work with COMPLIANCE_REPORT_FILE_TYPES constants', () => {
      expect(COMPLIANCE_REPORT_FILE_TYPES.MIME_TYPES).toContain(
        'application/pdf'
      )
      expect(COMPLIANCE_REPORT_FILE_TYPES.MIME_TYPES).toContain('image/png')
      expect(COMPLIANCE_REPORT_FILE_TYPES.MIME_TYPES).toContain('image/jpeg')
      expect(COMPLIANCE_REPORT_FILE_TYPES.DESCRIPTION).toContain('PDF')
      expect(COMPLIANCE_REPORT_FILE_TYPES.ACCEPT_STRING).toContain(
        'application/pdf'
      )
    })

    it('should work with SCHEDULE_IMPORT_FILE_TYPES constants', () => {
      expect(SCHEDULE_IMPORT_FILE_TYPES.MIME_TYPES).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      expect(SCHEDULE_IMPORT_FILE_TYPES.ACCEPT_STRING).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    })

    it('should generate correct accept strings', () => {
      const complianceAccept = COMPLIANCE_REPORT_FILE_TYPES.ACCEPT_STRING
      const scheduleAccept = SCHEDULE_IMPORT_FILE_TYPES.ACCEPT_STRING

      expect(complianceAccept).toContain(',')
      expect(complianceAccept.split(',').length).toBe(
        COMPLIANCE_REPORT_FILE_TYPES.MIME_TYPES.length
      )
      expect(scheduleAccept).not.toContain(',') // Only one type
    })
  })
})
