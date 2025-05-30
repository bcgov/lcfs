/**
 * Validates if a file's MIME type is allowed
 * @param {File} file - The file to validate
 * @param {Object} fileTypes - Object containing MIME_TYPES array and DESCRIPTION string
 * @returns {Object} - { isValid: boolean, errorMessage: string|null }
 */
export const validateFileMimeType = (file, fileTypes) => {
  if (!file) {
    return { isValid: false, errorMessage: 'No file selected' }
  }

  const isValid = fileTypes.MIME_TYPES.includes(file.type)

  if (!isValid) {
    return {
      isValid: false,
      errorMessage: `File type "${file.type || 'unknown'}" is not allowed. Please upload files of the following types: ${fileTypes.DESCRIPTION}`
    }
  }

  return { isValid: true, errorMessage: null }
}

/**
 * Validates multiple aspects of a file including MIME type and size
 * @param {File} file - The file to validate
 * @param {number} maxSizeBytes - Maximum allowed file size in bytes
 * @param {Object} fileTypes - Object containing MIME_TYPES array and DESCRIPTION string
 * @returns {Object} - { isValid: boolean, errorMessage: string|null }
 */
export const validateFile = (file, maxSizeBytes, fileTypes) => {
  // Check MIME type first
  const mimeValidation = validateFileMimeType(file, fileTypes)
  if (!mimeValidation.isValid) {
    return mimeValidation
  }

  // Check file size
  if (file.size > maxSizeBytes) {
    const maxSizeMB = Math.round(maxSizeBytes / 1024 / 1024)
    return {
      isValid: false,
      errorMessage: `File size exceeds the maximum limit of ${maxSizeMB} MB`
    }
  }

  return { isValid: true, errorMessage: null }
}
