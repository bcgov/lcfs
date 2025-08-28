import * as Yup from 'yup'

// Schema for form validation
export const schemaValidation = Yup.object({
  orgLegalName: Yup.string().required(
    'Legal Name of Organization is required.'
  ),
  orgOperatingName: Yup.string().required(
    'Operating Name of Organization is required.'
  ),
  orgEmailAddress: Yup.string()
    .required('Email Address is required.')
    .email('Please enter a valid Email Address.'),
  orgPhoneNumber: Yup.string()
    .required('Phone Number is required.')
    .matches(
      /^[0-9()+-\s]+$/,
      'Invalid format. Only numbers, spaces, parentheses, plus signs, and hyphens are allowed.'
    )
    .max(30, 'Phone number is too long.'),
  orgType: Yup.string().required('Organization type is required.'),
  orgRegForTransfers: Yup.string().required(
    'Registered For Transfers is required.'
  ),
  orgStreetAddress: Yup.string().required(
    'Street Address / PO Box is required.'
  ),
  orgCity: Yup.string().required('City is required.'),
  orgPostalCodeZipCode: Yup.string()
    .required('Postal / ZIP Code is required.')
    .matches(
      /^((\d{5}-\d{4})|(\d{5})|([A-Z]\d[A-Z]\s?\d[A-Z]\d))$/i,
      'Please enter a valid Postal / ZIP Code.'
    ),
  // Head Office fields are now optional
  orgHeadOfficeStreetAddress: Yup.string().nullable(),
  orgHeadOfficeCity: Yup.string().nullable(),
  orgHeadOfficeProvince: Yup.string().nullable(),
  orgHeadOfficeCountry: Yup.string().nullable(),
  orgHeadOfficePostalCodeZipCode: Yup.string().nullable(),
  hasEarlyIssuance: Yup.string().required('Early issuance setting is required')
})
