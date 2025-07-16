import { ROLES_BADGE_SIZE } from '@/constants/common'
import dayjs from 'dayjs'

/**
 * Formats a number with commas and specified decimal places.
 * Optionally uses parentheses instead of a minus sign for negative numbers.
 *
 * @param {Object|number|string|null} params - The input parameter which can be an object with a `value` property, a number, or a string.
 * @param {number|string} [params.value] - The value to be formatted, if params is an object.
 * @param {boolean} [useParentheses=false] - Whether to use parentheses for negative numbers.
 * @param maxDecimals the max number of decimals to return
 * @returns {string} - The formatted number as a string, or the original value if it cannot be parsed as a number.
 */
export const numberFormatter = (
  params,
  useParentheses = false,
  maxDecimals = 10
) => {
  if (params == null || (typeof params === 'object' && params.value == null))
    return ''

  const value = params.value ?? params
  const parsedValue = parseFloat(value)

  if (isNaN(parsedValue)) return value

  const absValue = Math.abs(parsedValue)
  const formattedValue = absValue.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals
  })

  if (parsedValue < 0) {
    return useParentheses ? `(${formattedValue})` : `-${formattedValue}`
  }

  return formattedValue
}

/**
 * Formats a number as currency in CAD.
 *
 * @param {Object|number|string|null} params - The input parameter which can be an object with a `value` property, a number, or a string.
 * @returns {string} - The formatted currency string, or the original value if it cannot be parsed as a number.
 */
export const currencyFormatter = (params) => {
  const cellValue =
    params && Object.hasOwn(params, 'value') ? params.value : params

  if (
    cellValue !== null &&
    (typeof cellValue === 'number' || !isNaN(Number(cellValue)))
  ) {
    return Number(cellValue).toLocaleString('en-CA', {
      style: 'currency',
      currency: 'CAD'
    })
  }
  return cellValue
}

/**
 * Formats a number to two decimal places.
 *
 * @param {Object} params - The input parameter which should have a `value` property.
 * @returns {string} - The formatted number with two decimal places, or the original value if it is null.
 */
export const decimalFormatter = (params) => {
  const cellValue =
    params && Object.hasOwn(params, 'value') ? params.value : params

  if (cellValue !== null) {
    return cellValue.toLocaleString('en', { minimumFractionDigits: 2 })
  }
  return cellValue
}

/**
 * Formats a date to YYYY-MM-DD format.
 *
 * @param {Object} params - The input parameter which should have a `value` property.
 * @returns {string} - The formatted date string, or an empty string if the value is null.
 */
export const dateFormatter = (params) => {
  const cellValue =
    params && Object.hasOwn(params, 'value') ? params.value : params

  if (cellValue != null) {
    // Format to only include the date part (YYYY-MM-DD)
    const date = new Date(cellValue)
    return date.toISOString().split('T')[0]
  }
  return ''
}

/**
 * Formats a date to Month Day, Year format.
 * e.g. January 1, 2024
 *
 * @param {string} dateString - The date string to format
 * @returns {string} - The formatted date string
 */
export const dateToLongString = (dateString) => {
  if (!dateString) return ''
  const date = dayjs(dateString)
  return date.format('MMMM D, YYYY')
}

/**
 * Formats a phone number to (123) 456-7890 format.
 *
 * @param {Object} params - The input parameter which should have a `value` property.
 * @returns {string} - The formatted phone number, or an empty string if the value is null or invalid.
 */
export const phoneNumberFormatter = (params) => {
  const phoneNumber = params?.value?.toString().replace(/\D/g, '') || ''
  if (!phoneNumber) {
    return ''
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(
    3,
    6
  )}-${phoneNumber.slice(6)}`
}

function camelToSnakeCase(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

/**
 * Converts camelCase keys of an object to snake_case.
 *
 * @param {Object} obj - The object whose keys need to be converted.
 * @returns {Object} - A new object with keys in snake_case.
 */
export function convertObjectKeys(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map(convertObjectKeys)
  }
  return Object.keys(obj).reduce((acc, current) => {
    const newKey = camelToSnakeCase(current)
    acc[newKey] = convertObjectKeys(obj[current])
    return acc
  }, {})
}

/**
 * Calculates the total value by multiplying quantity and price per unit.
 *
 * @param {number|string} quantity - The quantity of items.
 * @param {number|string} pricePerUnit - The price per unit.
 * @returns {number} - The total value, or 0 if inputs are not valid numbers.
 */
export const calculateTotalValue = (quantity, pricePerUnit) => {
  const quantityNum = parseFloat(quantity)
  const priceNum = parseFloat(pricePerUnit)
  return !isNaN(quantityNum) && !isNaN(priceNum) ? quantityNum * priceNum : 0
}

/**
 * Checks if a string represents a numeric value.
 *
 * @param {string} str - The string to check.
 * @returns {boolean} - True if the string is numeric, false otherwise.
 */
export function isNumeric(str) {
  if (typeof str !== 'string') return false
  return !isNaN(str) && !isNaN(parseFloat(str))
}

/**
 * Calculates the row height based on the width and roles.
 *
 * @param {number} elementWidth - The actual width available.
 * @param {Array} roles - An array of role objects with a `name` property.
 * @returns {number} - The calculated total height required for the rows.
 */
export function calculateRowHeight(elementWidth, roles) {
  const rowHeight = 42 // height of single row

  let currentRowWidth = 0
  let numRows = 1
  roles.forEach((role) => {
    if (
      currentRowWidth !== 0 &&
      currentRowWidth + ROLES_BADGE_SIZE[role.name] > elementWidth
    ) {
      numRows++
      currentRowWidth = ROLES_BADGE_SIZE[role.name]
    } else {
      currentRowWidth += ROLES_BADGE_SIZE[role.name]
    }
  })

  return numRows * rowHeight
}

/**
 * Formats a date and time according to the Vancouver timezone.
 *
 * @param {Object} params - The input parameter which should have a `value` property.
 * @returns {string} - The formatted date and time string.
 */
export const timezoneFormatter = ({ value }) => {
  const date = new Date(value)
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Vancouver',
    timeZoneName: 'short'
  }

  const formattedDate = date.toLocaleString('en-CA', options)
  return formattedDate.replace(',', '').replaceAll('.', '')
}

/**
 * Inserts spaces before capital letters in a string.
 *
 * @param {Object} params - The input parameter which should have a `value` property.
 * @returns {string} - The formatted string with spaces, or the original value if it is null.
 */
export const spacesFormatter = (params) => {
  if (params.value != null) {
    return params.value.replace(/([A-Z])/g, ' $1').trim()
  }
  return params.value
}

/**
 * Removes entries with empty string values from an object.
 *
 * @param {Object} obj - The object to clean.
 * @returns {Object} - A new object without empty string values.
 */
export const cleanEmptyStringValues = (obj) =>
  Object.entries(obj)
    .filter(([, value]) => value !== null && value !== '')
    .reduce((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {})

/**
 * Formats a number with commas.
 *
 * @param {Object} params - The input parameter which should have a `value` property.
 * @returns {string} - The formatted number with commas.
 */
export const formatNumberWithCommas = ({ value }) => {
  if (!value) return 0
  const [integerPart, decimalPart] = value.toString().split('.')

  let number = new Intl.NumberFormat('en-CA').format(integerPart)

  if (decimalPart !== undefined) {
    number = number + '.' + decimalPart
  }

  return number
}

/**
 * Removes commas from a formatted number string.
 *
 * @param {string} value - The formatted number string.
 * @returns {number} - The number without commas, or undefined if the input is invalid.
 */
export const formatNumberWithoutCommas = (value) => {
  const [integerPart, decimalPart] = value.split('.')

  let number = integerPart.replaceAll(',', '')

  const regex = /^\d*.?\d*$/
  if (!regex.test(number)) return

  if (decimalPart !== undefined) {
    if (!regex.test(decimalPart)) return
    number = number + '.' + decimalPart
  }

  return Number(number)
}

/**
 * Takes a date string and returns the full formatted date with timestamp and timezone
 * @param dateInput {string}
 * @returns {string}
 */
export const formatDateWithTimezoneAbbr = (dateInput) => {
  const time = dayjs(dateInput)
  const formattedDate = time.format('LLL')

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZoneName: 'short'
  })
  const parts = formatter.formatToParts(time.toDate())
  const timeZoneName = parts.find((part) => part.type === 'timeZoneName').value

  return `${formattedDate} ${timeZoneName}`
}
