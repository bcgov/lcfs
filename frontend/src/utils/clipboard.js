/**
 * Clipboard utilities for copying text with fallback support
 */

/**
 * Creates a temporary textarea element for clipboard fallback
 * @param {string} text - Text to copy
 * @returns {boolean} - Success status
 */
const createClipboardFallback = (text) => {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    const successful = document.execCommand('copy')
    return successful
  } catch (error) {
    console.error('execCommand copy failed:', error)
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}

/**
 * Copy text to clipboard with modern API and fallback support
 * @param {string} text - Text to copy to clipboard
 * @returns {Promise<boolean>} - Promise resolving to success status
 */
export const copyToClipboard = async (text) => {
  if (!text || typeof text !== 'string') {
    console.error('Invalid text provided to copyToClipboard')
    return false
  }

  // Try modern clipboard API first (requires secure context)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      console.warn('Clipboard API failed, falling back to execCommand:', error)
    }
  }

  // Fallback to execCommand for older browsers or insecure contexts
  return createClipboardFallback(text)
}

/**
 * Check if clipboard API is available
 * @returns {boolean} - Whether clipboard API is supported
 */
export const isClipboardSupported = () => {
  return !!(navigator.clipboard && window.isSecureContext)
}

export default {
  copyToClipboard,
  isClipboardSupported
}
