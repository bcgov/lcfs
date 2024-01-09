export const numberFormatter = (params) => {
  if (params.value != null) {
    return params.value.toLocaleString() // Use toLocaleString() to format numbers with commas
  }
  return params.value
}

export const phoneNumberFormatter = (params) => {
  const phoneNumber = params.value
  if (!phoneNumber) {
    return ''
  }
  // Format the phone number as needed (e.g., (123) 456-7890)
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(
    3,
    6
  )}-${phoneNumber.slice(6)}`
}
