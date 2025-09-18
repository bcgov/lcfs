import * as Yup from 'yup'

// Dynamic schema function based on organization type
export const createValidationSchema = (
  orgTypes = [],
  selectedOrgTypeId = null
) => {
  // Find the selected organization type
  const selectedOrgType = orgTypes.find(
    (type) => type.organizationTypeId === parseInt(selectedOrgTypeId)
  )

  // Check if the selected org type requires BCeID
  const requiresBCeID = selectedOrgType?.isBceidUser ?? true // Default to true for safety

  return Yup.object({
    orgLegalName: Yup.string().required(
      'Legal Name of Organization is required.'
    ),
    orgOperatingName: Yup.string().required(
      'Operating Name of Organization is required.'
    ),
    orgEmailAddress: Yup.string()
      .required('Email Address is required.')
      .email('Please enter a valid Email Address.'),
    orgPhoneNumber: requiresBCeID
      ? Yup.string()
          .required('Phone Number is required.')
          .matches(
            /^[0-9()+-\s]+$/,
            'Invalid format. Only numbers, spaces, parentheses, plus signs, and hyphens are allowed.'
          )
          .max(30, 'Phone number is too long.')
      : Yup.string()
          .test(
            'phone-format',
            'Invalid format. Only numbers, spaces, parentheses, plus signs, and hyphens are allowed.',
            (value) => !value || /^[0-9()+-\s]*$/.test(value)
          )
          .max(30, 'Phone number is too long.')
          .nullable(),
    orgType: Yup.string().required('Organization type is required.'),
    orgRegForTransfers: Yup.string().required(
      'Registered For Transfers is required.'
    ),
    orgStreetAddress: requiresBCeID
      ? Yup.string().required('Street Address / PO Box is required.')
      : Yup.string().nullable(),
    orgCity: requiresBCeID
      ? Yup.string().required('City is required.')
      : Yup.string().nullable(),
    orgPostalCodeZipCode: requiresBCeID
      ? Yup.string()
          .required('Postal / ZIP Code is required.')
          .matches(
            /^((\d{5}-\d{4})|(\d{5})|([A-Z]\d[A-Z]\s?\d[A-Z]\d))$/i,
            'Please enter a valid Postal / ZIP Code.'
          )
      : Yup.string()
          .test(
            'postal-code-format',
            'Please enter a valid Postal / ZIP Code.',
            (value) =>
              !value ||
              /^((\d{5}-\d{4})|(\d{5})|([A-Z]\d[A-Z]\s?\d[A-Z]\d))$/i.test(
                value
              )
          )
          .nullable(),
    // Head Office fields are optional for all org types
    orgHeadOfficeStreetAddress: Yup.string().nullable(),
    orgHeadOfficeCity: Yup.string().nullable(),
    orgHeadOfficeProvince: Yup.string().nullable(),
    orgHeadOfficeCountry: Yup.string().nullable(),
    orgHeadOfficePostalCodeZipCode: Yup.string().nullable(),
    hasEarlyIssuance: Yup.string().required(
      'Early issuance setting is required'
    )
  })
}

export const schemaValidation = createValidationSchema([], null)
