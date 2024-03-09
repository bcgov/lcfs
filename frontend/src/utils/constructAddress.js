/* eslint-disable camelcase */
export const constructAddress = ({
  streetAddress,
  addressOther,
  city,
  provinceState,
  country,
  postalcodeZipcode
}) => {
  return `${
    addressOther && `${addressOther} -`
  } ${streetAddress}, ${city} ${provinceState} ${country}, ${postalcodeZipcode}`
}
