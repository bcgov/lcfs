import * as Yup from 'yup'

export const AddEditTransferSchema = Yup.object({
  agreementDate: Yup.date()
    .required('Agreement Date is required')
    .max(new Date(), 'Agreement Date cannot be in the future'),
  quantity: Yup.number()
    .typeError('Quantity must be a number')
    .required('Quantity is required')
    .positive('Quantity must be positive')
    .integer('Quantity must be a whole number'),
  toOrganizationId: Yup.string().required('Organization selection is required'),
  fromOrganizationId: Yup.string().required(
    'Supplier organization is required'
  ),
  pricePerUnit: Yup.number()
    .typeError('Price must be a number')
    .required('Price per unit is required')
    .min(0, 'Price cannot be negative')
    .test(
      'maxDigitsAfterDecimal',
      'Price must have 2 or fewer decimal places',
      (number) => /^\d+(\.\d{1,2})?$/.test(number)
    )
})
