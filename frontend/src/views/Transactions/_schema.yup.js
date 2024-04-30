import * as Yup from 'yup'

export const AddEditTransactionSchema = Yup.object({
    txnType: Yup.string()
        .required('Transaction type is required.'),
    organizationId: Yup.string()
        .required('Organization selection is required'), 
    complianceUnits: Yup.number()
        .typeError('Compliance units must be a number')
        .when("txnType", (txnType, schema) => {
        return txnType[0] === 'initiativeAgreement'
            ? schema.positive('Compliance units must be positive for Initiative agreements')
            : schema;
        })
        .required('Compliance units is required'),
    effectiveDate: Yup.date()
        .max(new Date(), 'Effective Date cannot be in the future'),
    toOrgComment: Yup.string()
})
