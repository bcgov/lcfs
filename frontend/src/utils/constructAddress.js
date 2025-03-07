/* eslint-disable camelcase */
export const constructAddress = (address) => {
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
