/**
 * Client-side validation utilities for allocation agreement data
 */

/**
 * Validates email format
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid email format
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * Validates phone number format (allows various formats)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid phone format
 */
export const validatePhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return false
  // Allow various phone formats: (xxx) xxx-xxxx, xxx-xxx-xxxx, xxx.xxx.xxxx, xxxxxxxxxx
  const phoneRegex = /^[\+]?[1-9]?[\d\s\-\(\)\.]{7,15}$/
  return phoneRegex.test(phone.trim())
}

/**
 * Validates that a value is required (not empty, null, or undefined)
 * @param {any} value - Value to validate
 * @returns {boolean} - True if value exists and is not empty
 */
export const validateRequired = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return !isNaN(value)
  return Boolean(value)
}

/**
 * Validates numeric value is positive
 * @param {any} value - Value to validate
 * @returns {boolean} - True if value is a positive number
 */
export const validatePositiveNumber = (value) => {
  if (value === null || value === undefined || value === '') return false
  const num = Number(value)
  return !isNaN(num) && num > 0
}

/**
 * Validates numeric value is non-negative (including zero)
 * @param {any} value - Value to validate
 * @returns {boolean} - True if value is a non-negative number
 */
export const validateNonNegativeNumber = (value) => {
  if (value === null || value === undefined || value === '') return false
  const num = Number(value)
  return !isNaN(num) && num >= 0
}

/**
 * Validates that a string doesn't exceed maximum length
 * @param {string} value - String to validate
 * @param {number} maxLength - Maximum allowed length
 * @returns {boolean} - True if string is within length limit
 */
export const validateMaxLength = (value, maxLength = 255) => {
  if (!value) return true // Allow empty values, use validateRequired for required fields
  return typeof value === 'string' && value.length <= maxLength
}

/**
 * Validates postal code format (Canadian and US formats)
 * @param {string} postalCode - Postal code to validate
 * @returns {boolean} - True if valid postal code format
 */
export const validatePostalCode = (postalCode) => {
  if (!postalCode || typeof postalCode !== 'string') return false
  const code = postalCode.trim().toUpperCase()
  // Canadian: A1A 1A1 or A1A1A1
  const canadianRegex = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/
  // US: 12345 or 12345-6789
  const usRegex = /^\d{5}(-\d{4})?$/
  return canadianRegex.test(code) || usRegex.test(code)
}

/**
 * Validates allocation agreement row data
 * @param {Object} rowData - Row data to validate
 * @param {Object} options - Validation options and reference data
 * @returns {Object} - { isValid: boolean, errors: Array<{field: string, message: string}> }
 */
export const validateAllocationAgreementRow = (rowData, options = {}) => {
  const errors = []
  const { fuelTypes = [], organizations = [] } = options

  // Required field validations
  const requiredFields = [
    { field: 'transactionPartner', label: 'Transaction Partner' },
    { field: 'fuelType', label: 'Fuel Type' },
    { field: 'fuelCategory', label: 'Fuel Category' },
    { field: 'quantity', label: 'Quantity' }
  ]

  requiredFields.forEach(({ field, label }) => {
    if (!validateRequired(rowData[field])) {
      errors.push({
        field,
        message: `${label} is required`
      })
    }
  })

  // Email validation
  if (rowData.email && !validateEmail(rowData.email)) {
    errors.push({
      field: 'email',
      message: 'Please enter a valid email address'
    })
  }

  // Phone number validation
  if (rowData.phoneNumber && !validatePhoneNumber(rowData.phoneNumber)) {
    errors.push({
      field: 'phoneNumber',
      message: 'Please enter a valid phone number'
    })
  }

  // Quantity validation
  if (rowData.quantity !== undefined && !validatePositiveNumber(rowData.quantity)) {
    errors.push({
      field: 'quantity',
      message: 'Quantity must be a positive number'
    })
  }

  // Fuel type validation (if reference data available)
  if (fuelTypes.length > 0 && rowData.fuelType) {
    const fuelTypeExists = fuelTypes.some(ft => 
      ft.fuelType === rowData.fuelType || ft.id === rowData.fuelType
    )
    if (!fuelTypeExists) {
      errors.push({
        field: 'fuelType',
        message: 'Invalid fuel type selected'
      })
    }
  }

  // Transaction partner validation (if reference data available)
  if (organizations.length > 0 && rowData.transactionPartner) {
    const orgExists = organizations.some(org => 
      org.name === rowData.transactionPartner || org.id === rowData.transactionPartner
    )
    if (!orgExists) {
      errors.push({
        field: 'transactionPartner',
        message: 'Invalid transaction partner selected'
      })
    }
  }

  // Field length validations
  const fieldLengthLimits = [
    { field: 'addressForService', maxLength: 500 },
    { field: 'email', maxLength: 255 },
    { field: 'phoneNumber', maxLength: 50 },
    { field: 'fuelTypeOther', maxLength: 255 },
    { field: 'fuelCode', maxLength: 255 }
  ]

  fieldLengthLimits.forEach(({ field, maxLength }) => {
    if (rowData[field] && !validateMaxLength(rowData[field], maxLength)) {
      errors.push({
        field,
        message: `${field} must not exceed ${maxLength} characters`
      })
    }
  })

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Real-time field validator for AG-Grid cell editing
 * @param {any} value - Value to validate
 * @param {string} field - Field name being validated
 * @param {Object} rowData - Complete row data for context
 * @param {Object} options - Validation options and reference data
 * @returns {string|null} - Error message or null if valid
 */
export const validateField = (value, field, rowData = {}, options = {}) => {
  const tempRowData = { ...rowData, [field]: value }
  const validation = validateAllocationAgreementRow(tempRowData, options)
  
  const fieldError = validation.errors.find(error => error.field === field)
  return fieldError ? fieldError.message : null
}

/**
 * Validates multiple rows and returns summary
 * @param {Array} rows - Array of row data to validate
 * @param {Object} options - Validation options and reference data
 * @returns {Object} - { validRows: Array, invalidRows: Array, summary: Object }
 */
export const validateAllocationAgreementRows = (rows, options = {}) => {
  const validRows = []
  const invalidRows = []
  
  rows.forEach((row, index) => {
    const validation = validateAllocationAgreementRow(row, options)
    
    if (validation.isValid) {
      validRows.push(row)
    } else {
      invalidRows.push({
        ...row,
        rowIndex: index,
        validationErrors: validation.errors
      })
    }
  })
  
  return {
    validRows,
    invalidRows,
    summary: {
      total: rows.length,
      valid: validRows.length,
      invalid: invalidRows.length,
      validationRate: rows.length > 0 ? (validRows.length / rows.length) * 100 : 0
    }
  }
}