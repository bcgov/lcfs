import * as Yup from 'yup'

export const AddEditTransactionSchema = Yup.object({
    txnType: Yup.string()
        .required('Transaction type is required.'),
    toOrganizationId: Yup.string()
        .required('Organization selection is required'), 
    complianceUnits: Yup.number()
        .typeError('Compliance units must be a number')
        .when("txnType", (txnType, schema) => {
        return txnType[0] === 'initiativeAgreement'
            ? schema.positive('Compliance units must be positive for Initiative agreements')
            : schema;
        })
        .required('Compliance units is required'),
    transactionEffectiveDate: Yup.string()
        .transform((value, originalValue) => {
          // Check if the original value is an empty string and return null
          return originalValue === '' ? null : new Date(value).toISOString().split('T')[0];
        })
        .max(new Date(), 'Effective Date cannot be in the future')
        .nullable().default(null),
    toOrgComment: Yup.string()
})
