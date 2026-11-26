import { POSTAL_CODE_REGEX } from '@/constants/common'

interface AddressData {
  fullAddress?: string | null
  postalCode?: string | null
  postal_code?: string | null
}

export const addressHasPostalCode = (value: string | null | undefined) =>
  POSTAL_CODE_REGEX.test(value || '')

export const addressWithPostalCode = (
  addressData: string | AddressData | null | undefined
) => {
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
