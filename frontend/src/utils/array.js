/**
 * Checks if an array or an array within an object is empty.
 *
 * @param {Array|Object} data - The data to check.
 * @returns {boolean|null} - True if the array is empty, false if not, or null if the input is not an array or object.
 */
export const isArrayEmpty = (data) => {
  if (Array.isArray(data)) {
    return data.length === 0
  }
  if (typeof data === 'object' && data !== null) {
    const keys = Object.keys(data)
    const arrayKey = keys.find((key) => key !== 'pagination')
    if (arrayKey && Array.isArray(data[arrayKey])) {
      return data[arrayKey].length === 0
    }
  }
  return null
}
