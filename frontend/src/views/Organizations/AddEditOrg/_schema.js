import * as Yup from 'yup'

const SPECIAL_ADDRESS_TYPE_KEYS = new Set(['fuel_producer', 'lcjfip'])

const isSpecialAddressOrganization = (selectedOrgTypes) =>
  selectedOrgTypes.length > 0 &&
  selectedOrgTypes.every((type) =>
    SPECIAL_ADDRESS_TYPE_KEYS.has(type.orgType)
  )

const phoneFormat = /^[0-9()+.\-\s]+(?:\s*(?:x|ext\.?|#)\s*[0-9]+)?$/i
const postalCodeFormat = /^[A-Za-z0-9][A-Za-z0-9\s\-]{1,11}$/

// Dynamic schema function based on the selected organization types
export const createValidationSchema = (
  orgTypes = [],
  selectedOrgTypeIds = []
) => {
  // Find the selected organization types
  const selectedIds = (selectedOrgTypeIds || []).map((id) => parseInt(id))
  const selectedOrgTypes = orgTypes.filter((type) =>
    selectedIds.includes(type.organizationTypeId)
  )

  // BCeID rules apply when any selected org type is a BCeID type
  const requiresBCeID =
    selectedOrgTypes.length === 0 ||
    selectedOrgTypes.some((type) => type.isBceidUser) // Default to true for safety
  const requiresSpecialAddress =
    isSpecialAddressOrganization(selectedOrgTypes)

  return Yup.object({
    orgLegalName: Yup.string().required(
      'Legal name of organization is required.'
    ),
    orgOperatingName: Yup.string().required(
      'Operating name of organization is required.'
    ),
    orgContactName: Yup.string().nullable(),
    orgEmailAddress: Yup.string()
      .required('Email address is required.')
      .email('Please enter a valid email address.'),
    orgPhoneNumber: requiresBCeID
      ? Yup.string()
          .required('Phone number is required.')
          .matches(
            phoneFormat,
            'Invalid phone number format.'
          )
          .max(50, 'Phone number is too long.')
      : Yup.string()
          .test(
            'phone-format',
            'Invalid phone number format.',
            (value) => !value || phoneFormat.test(value)
          )
          .max(50, 'Phone number is too long.')
          .nullable(),
    orgTypeIds: Yup.array()
      .of(Yup.string())
      .min(1, 'At least one organization type is required.'),
    availableRoles: Yup.array().of(Yup.string()),
    orgRegForTransfers: Yup.string().required(
      'Registered for transfers is required.'
    ),
    orgStreetAddress: requiresBCeID && !requiresSpecialAddress
      ? Yup.string().required('Street address / PO box is required.')
      : Yup.string().nullable(),
    orgCity: requiresBCeID && !requiresSpecialAddress
      ? Yup.string().required('City is required.')
      : Yup.string().nullable(),
    orgPostalCodeZipCode: requiresBCeID && !requiresSpecialAddress
      ? Yup.string()
          .required('Postal / ZIP code is required.')
          .matches(
            postalCodeFormat,
            'Please enter a valid postal / ZIP code.'
          )
      : Yup.string()
          .test(
            'postal-code-format',
            'Please enter a valid postal / ZIP code.',
            (value) => !value || postalCodeFormat.test(value)
          )
          .nullable(),
    orgHeadOfficeStreetAddress: requiresSpecialAddress
      ? Yup.string().required('Head office street address is required.')
      : Yup.string().nullable(),
    orgHeadOfficeCity: requiresSpecialAddress
      ? Yup.string().required('Head office city is required.')
      : Yup.string().nullable(),
    orgHeadOfficeProvince: Yup.string().nullable(),
    orgHeadOfficeCountry: Yup.string().nullable(),
    orgHeadOfficePostalCodeZipCode: requiresSpecialAddress
      ? Yup.string()
          .required('Head office postal / ZIP code is required.')
          .matches(
            postalCodeFormat,
            'Please enter a valid postal / ZIP code.'
          )
          .max(30, 'Postal / ZIP code is too long.')
      : Yup.string()
          .test(
            'postal-code-format',
            'Please enter a valid postal / ZIP code.',
            (value) => !value || postalCodeFormat.test(value)
          )
          .max(30, 'Postal / ZIP code is too long.')
          .nullable(),
    hasEarlyIssuance: Yup.string().required(
      'Early issuance setting is required'
    )
  })
}

export const schemaValidation = createValidationSchema([], [])
