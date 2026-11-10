const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * Checks if an array or an array within an object is empty.
 *
 * @param {Array|Object} data - The data to check.
 * @returns {boolean|null} - True if the array is empty, false if not, or null if the input is not an array or object.
 */
export const isArrayEmpty = (data: unknown): boolean | null => {
  if (Array.isArray(data)) {
    return data.length === 0
  }
  if (isObjectRecord(data)) {
    const keys = Object.keys(data)
    const arrayKey = keys.find((key) => key !== 'pagination')
    const value = arrayKey ? data[arrayKey] : undefined
    if (Array.isArray(value)) {
      return value.length === 0
    }
  }
  return null
}
