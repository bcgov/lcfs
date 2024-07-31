import { ROLES_BADGE_SIZE } from '@/constants/common'

/**
 * Formats a number with commas and specified decimal places.
 *
 * @param {Object|number|string} params - The input parameter which can be an object with a `value` property, a number, or a string.
 * @param {number|string} [params.value] - The value to be formatted, if params is an object.
 * @returns {string} - The formatted number as a string, or the original value if it cannot be parsed as a number.
 */
export const numberFormatter = (params) => {
  if (params == null || (typeof params === 'object' && params.value == null)) return ''

  const value = params.value ?? params
  const parsedValue = parseFloat(value)
  
  if (isNaN(parsedValue)) return value

  return parsedValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 10 })
}

export const currencyFormatter = (params) => {
  if (params.value != null) {
    return params.value.toLocaleString('en-CA', {
      style: 'currency',
      currency: 'CAD'
    })
  } else if (params !== null) {
    return params.toLocaleString('en-CA', {
      style: 'currency',
      currency: 'CAD'
    })
  }
  return params.value
}

export const decimalFormatter = (params) => {
  if (params.value != null) {
    return params.value.toLocaleString('en', { minimumFractionDigits: 2 }) // round to 2 decimal places
  } else if (params !== null) {
    return params.toLocaleString('en', { minimumFractionDigits: 2 })
  }
  return params.value
}
export const dateFormatter = (params) => {
  if (params.value != null) {
    // Assuming params.value is a Date object, or can be converted to one
    const date = new Date(params.value)
    return date.toISOString().split('T')[0]
  } else if (params !== null) {
    // Assuming params.value is a Date object, or can be converted to one
    const date = new Date(params)
    return date.toISOString().split('T')[0]
  }
  return params.value
}

export const phoneNumberFormatter = (params) => {
  const phoneNumber = params?.value?.toString().replace(/\D/g, '') || ''
  if (!phoneNumber) {
    return ''
  }
  // Format the phone number as (123) 456-7890
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(
    3,
    6
  )}-${phoneNumber.slice(6)}`
}

function camelToSnakeCase(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

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

export const calculateTotalValue = (quantity, pricePerUnit) => {
  const quantityNum = parseFloat(quantity)
  const priceNum = parseFloat(pricePerUnit)
  return !isNaN(quantityNum) && !isNaN(priceNum) ? quantityNum * priceNum : 0
}

export function isNumeric(str) {
  if (typeof str !== 'string') return false // We only process strings!
  return !isNaN(str) && !isNaN(parseFloat(str))
}

export function calculateRowHeight(actualWidth, roles) {
  const rowHeight = 42 // height of single row
  let summedWidth = 70 // width including padding and margins
  let numRows = 1
  roles.forEach((role) => {
    if (summedWidth + parseInt(ROLES_BADGE_SIZE[role.name]) > actualWidth) {
      numRows++
      summedWidth = parseInt(ROLES_BADGE_SIZE[role.name]) + 70
    } else {
      summedWidth += parseInt(ROLES_BADGE_SIZE[role.name])
    }
  })

  // Calculate the total height required
  const totalHeight = numRows * rowHeight

  return totalHeight
}

export const timezoneFormatter = ({ value }) => {
  const date = new Date(value)
  // Format the date and time parts
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

export const spacesFormatter = (params) => {
  if (params.value != null) {
    return params.value.replace(/([A-Z])/g, ' $1').trim();
  }
  return params.value;
}
