import { POSTAL_CODE_REGEX } from '@/constants/common'

export const addressHasPostalCode = (value) =>
  POSTAL_CODE_REGEX.test(value || '')

export const addressWithPostalCode = (addressData) => {
  if (typeof addressData === 'string') {
    return addressData
  }

  const fullAddress = addressData?.fullAddress || ''
  const postalCode = addressData?.postalCode || addressData?.postal_code || ''

  if (!postalCode || addressHasPostalCode(fullAddress)) {
    return fullAddress
  }

  return `${fullAddress}, ${postalCode}`
}
