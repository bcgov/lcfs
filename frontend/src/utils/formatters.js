export const numberFormatter = (params) => {
  if (params.value != null) {
    return parseInt(params.value).toLocaleString() // Use toLocaleString() to format numbers with commas
  } else if (params !== null) {
    return parseInt(params).toLocaleString()
  }
  return params.value
}

export const currencyFormatter = (params) => {
  if (params.value != null) {
    return params.value.toLocaleString('en-CA', {
      style: 'currency',
      currency: 'CAD',
    })
  } else if (params !== null) {
    return params.toLocaleString('en-CA', {
      style: 'currency',
      currency: 'CAD',
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
    const date = new Date(params.value);
    return date.toISOString().split('T')[0];
  } else if (params !== null) {
    // Assuming params.value is a Date object, or can be converted to one
    const date = new Date(params);
    return date.toISOString().split('T')[0];
  }
  return params.value;
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
  if (typeof str !== 'string') return false; // We only process strings!
  return !isNaN(str) && !isNaN(parseFloat(str));
}

export function calculateRowHeight(columnWidth, size) {
  let height = 45
  if (size <= 1) {
    return height
  }
  if (columnWidth >= 0 && columnWidth <= 262) {
    switch (size) {
      case 2:
        height = 90
        break
      case 3:
        height = 135
        break
      case 4:
        height = 180
        break
    }
  } else if (columnWidth >= 263 && columnWidth <= 382) {
    switch (size) {
      case 2:
        height = 45
        break
      case 3:
      case 4:
        height = 90
        break
    }
  } else if (columnWidth >= 383 && columnWidth <= 594) {
    switch (size) {
      case 2:
      case 3:
        height = 45
        break
      default:
        height = 90
        break
    }
  } else if (columnWidth > 595) {
    return (height = 45)
  }

  return height + 22
}