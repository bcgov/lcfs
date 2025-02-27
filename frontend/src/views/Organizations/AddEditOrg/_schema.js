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
  orgSupplierType: Yup.string().required('Supplier type is required.'),
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
  orgAttorneyStreetAddress: Yup.string().required(
    'Street Address / PO Box is required.'
  ),
  orgAttorneyCity: Yup.string().required('City is required.'),
  orgAttorneyPostalCodeZipCode: Yup.string()
    .required('Postal / ZIP Code is required.')
    .matches(
      /^((\d{5}-\d{4})|(\d{5})|([A-Z]\d[A-Z]\s?\d[A-Z]\d))$/i,
      'Please enter a valid Postal / ZIP Code.'
    ),
  hasEarlyIssuance: Yup.string().required('Early issuance setting is required')
})
