export const numberFormatter = (params) => {
  if (params.value != null) {
    return params.value.toLocaleString() // Use toLocaleString() to format numbers with commas
  }
  return params.value
}
export const decimalFormatter = (params) => {
  if (params.value != null) {
    return params.value.toLocaleString('en', { minimumFractionDigits: 2 }) // round to 2 decimal places
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

export function formatDateToISO(date) {
  return date.toISOString().split('T')[0]
}
