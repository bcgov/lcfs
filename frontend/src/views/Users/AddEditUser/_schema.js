import * as Yup from 'yup'

// Schema for form validation
export const schemaValidation = Yup.object({
  firstName: Yup.string().required(
    'First name is required.'
  ),
  lastName: Yup.string().required(
    'Last name is required.'
  ),
  jobTitle: Yup.string().required('Title is required.'),
  userName: Yup.string().required('User name is required'),
  email: Yup.string()
    .required('Email Address is required.')
    .email('Please enter a valid Email Address.'),
  phone: Yup.number("Valid phone number is required"),
  mobilePhone: Yup.number(),
  status: Yup.string(),
  roles: Yup.string().required('One or more role is required.')
})
