/* eslint-disable camelcase */
export const constructAddress = ({
  street_address,
  address_other,
  city,
  province_state,
  country,
  postalCode_zipCode
}) => {
  return `${
    address_other && `${address_other} -`
  } ${street_address}, ${city} ${province_state} ${country}, ${postalCode_zipCode}`
}
