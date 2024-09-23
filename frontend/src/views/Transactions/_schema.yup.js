import * as Yup from 'yup'

export const AddEditTransactionSchema = Yup.object({
  txnType: Yup.string().required('Transaction type is required'),
  toOrganizationId: Yup.string().required('Organization selection is required'),
  complianceUnits: Yup.number()
    .typeError('Compliance units must be a number')
    .when('txnType', (txnType, schema) => {
      return txnType[0] === 'initiativeAgreement'
        ? schema.positive(
            'Compliance units must be positive for Initiative agreements'
          )
        : schema
    })
    .required('Compliance units is required'),
  transactionEffectiveDate: Yup.string()
    .transform((value, originalValue) => {
      // If the original value is an empty string, return null
      if (originalValue === '' || originalValue == null) {
        return null
      }
      const date = new Date(value)
      return date.toISOString().split('T')[0]
    })
    .test(
      'is-valid-date',
      'Effective Date cannot be in the future',
      function (value) {
        if (value === null) {
          return true // null is allowed
        }
        return new Date(value) <= new Date()
      }
    )
    .nullable()
    .default(null),
  toOrgComment: Yup.string(),
  internalComment: Yup.string()
})
