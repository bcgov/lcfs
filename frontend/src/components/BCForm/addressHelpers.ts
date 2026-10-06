import type { AddressOption } from './AddressAutocomplete'
import { POSTAL_CODE_REGEX } from '@/constants/common'

export type AddressValue = string | AddressOption | null | undefined

export const addressHasPostalCode = (value: AddressValue) =>
  POSTAL_CODE_REGEX.test(
    typeof value === 'string'
      ? value
      : [value?.fullAddress, value?.postalCode, value?.postal_code]
          .filter(Boolean)
          .join(' ')
  )
