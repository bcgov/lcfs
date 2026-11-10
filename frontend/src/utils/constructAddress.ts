export interface Address {
  streetAddress?: string | null
  addressOther?: string | null
  city?: string | null
  provinceState?: string | null
  country?: string | null
  postalcodeZipcode?: string | null
}

export const constructAddress = (address?: Address | null): string => {
  const {
    streetAddress = '',
    addressOther = '',
    city = '',
    provinceState = '',
    country = '',
    postalcodeZipcode = ''
  } = address ?? {}
  const parts = [
    addressOther ? `${addressOther} -` : '',
    streetAddress,
    city,
    provinceState,
    country,
    postalcodeZipcode
  ].filter((part) => part && part.trim() !== '')

  return parts.join(', ')
}
