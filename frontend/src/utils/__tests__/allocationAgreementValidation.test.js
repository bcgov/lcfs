import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validatePhoneNumber,
  validateRequired,
  validatePositiveNumber,
  validateNonNegativeNumber,
  validateMaxLength,
  validatePostalCode,
  validateAllocationAgreementRow,
  validateField,
  validateAllocationAgreementRows
} from '../allocationAgreementValidation'

describe('AllocationAgreementValidation', () => {
  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true)
    })

    it('should reject invalid email formats', () => {
      expect(validateEmail('invalid-email')).toBe(false)
      expect(validateEmail('test@')).toBe(false)
      expect(validateEmail('@domain.com')).toBe(false)
      expect(validateEmail('')).toBe(false)
      expect(validateEmail(null)).toBe(false)
    })
  })

  describe('validatePhoneNumber', () => {
    it('should validate correct phone formats', () => {
      expect(validatePhoneNumber('123-456-7890')).toBe(true)
      expect(validatePhoneNumber('(123) 456-7890')).toBe(true)
      expect(validatePhoneNumber('1234567890')).toBe(true)
      expect(validatePhoneNumber('+1-123-456-7890')).toBe(true)
    })

    it('should reject invalid phone formats', () => {
      expect(validatePhoneNumber('123')).toBe(false)
      expect(validatePhoneNumber('abc-def-ghij')).toBe(false)
      expect(validatePhoneNumber('')).toBe(false)
      expect(validatePhoneNumber(null)).toBe(false)
    })
  })

  describe('validateRequired', () => {
    it('should validate required fields', () => {
      expect(validateRequired('test')).toBe(true)
      expect(validateRequired(123)).toBe(true)
      expect(validateRequired(0)).toBe(true)
      expect(validateRequired(false)).toBe(false)
    })

    it('should reject empty or null values', () => {
      expect(validateRequired('')).toBe(false)
      expect(validateRequired('   ')).toBe(false)
      expect(validateRequired(null)).toBe(false)
      expect(validateRequired(undefined)).toBe(false)
    })
  })

  describe('validatePositiveNumber', () => {
    it('should validate positive numbers', () => {
      expect(validatePositiveNumber(1)).toBe(true)
      expect(validatePositiveNumber('123')).toBe(true)
      expect(validatePositiveNumber(0.1)).toBe(true)
    })

    it('should reject zero and negative numbers', () => {
      expect(validatePositiveNumber(0)).toBe(false)
      expect(validatePositiveNumber(-1)).toBe(false)
      expect(validatePositiveNumber('abc')).toBe(false)
      expect(validatePositiveNumber('')).toBe(false)
      expect(validatePositiveNumber(null)).toBe(false)
    })
  })

  describe('validateAllocationAgreementRow', () => {
    const validRowData = {
      transactionPartner: 'Test Partner',
      fuelType: 'Gasoline',
      fuelCategory: 'Petroleum-based',
      quantity: 100,
      email: 'test@example.com',
      phoneNumber: '123-456-7890'
    }

    it('should validate a complete valid row', () => {
      const result = validateAllocationAgreementRow(validRowData)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing required fields', () => {
      const invalidRowData = {
        ...validRowData,
        transactionPartner: '',
        quantity: null
      }
      
      const result = validateAllocationAgreementRow(invalidRowData)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(3)
      expect(result.errors.some(e => e.field === 'transactionPartner')).toBe(true)
      expect(result.errors.some(e => e.field === 'quantity')).toBe(true)
    })

    it('should detect invalid email format', () => {
      const invalidRowData = {
        ...validRowData,
        email: 'invalid-email'
      }
      
      const result = validateAllocationAgreementRow(invalidRowData)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('email')
    })

    it('should detect invalid phone format', () => {
      const invalidRowData = {
        ...validRowData,
        phoneNumber: '123'
      }
      
      const result = validateAllocationAgreementRow(invalidRowData)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('phoneNumber')
    })

    it('should detect invalid quantity', () => {
      const invalidRowData = {
        ...validRowData,
        quantity: -5
      }
      
      const result = validateAllocationAgreementRow(invalidRowData)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('quantity')
    })
  })

  describe('validateField', () => {
    it('should validate individual fields', () => {
      const rowData = { transactionPartner: 'Test Partner' }
      
      // Valid email
      expect(validateField('test@example.com', 'email', rowData)).toBe(null)
      
      // Invalid email
      expect(validateField('invalid-email', 'email', rowData)).toContain('valid email')
      
      // Valid quantity
      expect(validateField(100, 'quantity', rowData)).toBe(null)
      
      // Invalid quantity
      expect(validateField(-5, 'quantity', rowData)).toContain('positive number')
    })
  })

  describe('validateAllocationAgreementRows', () => {
    const validRow = {
      transactionPartner: 'Test Partner',
      fuelType: 'Gasoline',
      fuelCategory: 'Petroleum-based',
      quantity: 100
    }

    const invalidRow = {
      transactionPartner: '',
      fuelType: 'Gasoline',
      fuelCategory: '',
      quantity: -5
    }

    it('should validate multiple rows and return summary', () => {
      const rows = [validRow, invalidRow, validRow]
      const result = validateAllocationAgreementRows(rows)
      
      expect(result.validRows).toHaveLength(2)
      expect(result.invalidRows).toHaveLength(1)
      expect(result.summary.total).toBe(3)
      expect(result.summary.valid).toBe(2)
      expect(result.summary.invalid).toBe(1)
      expect(result.summary.validationRate).toBeCloseTo(66.67, 2)
    })

    it('should handle empty array', () => {
      const result = validateAllocationAgreementRows([])
      
      expect(result.validRows).toHaveLength(0)
      expect(result.invalidRows).toHaveLength(0)
      expect(result.summary.total).toBe(0)
      expect(result.summary.validationRate).toBe(0)
    })
  })
})