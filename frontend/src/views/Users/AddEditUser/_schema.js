import * as Yup from 'yup'
import { govRoles, nonGovRoles, roles } from '@/constants/roles'
import { PHONE_REGEX } from '@/constants/common'

// Schema for form validation
export const userInfoSchema = (userType) =>
  Yup.object({
    firstName: Yup.string().required('First name is required.'),
    lastName: Yup.string().required('Last name is required.'),
    jobTitle:
      userType === 'bceid'
        ? Yup.string().optional()
        : Yup.string().required('Job title is required.'),
    userName: Yup.string().required('User name is required'),
    keycloakEmail: Yup.string()
      .required('Email address is required.')
      .email('Please enter a valid email address.'),
    altEmail: Yup.string()
      .email('Please enter a valid email address.')
      .optional(),
    phone: Yup.string()
      .matches(PHONE_REGEX, 'Phone number is not valid')
      .nullable(true),
    mobilePhone: Yup.string()
      .matches(PHONE_REGEX, 'Phone number is not valid')
      .nullable(true),
    status: Yup.string(),
    adminRole: Yup.array(),
    idirRole: Yup.string(),
    bceidRoles: Yup.array(),
    readOnly: Yup.string()
  })

export const idirTextFields = (t) => [
  {
    name: 'firstName',
    label: t('admin:userForm.firstName')
  },
  {
    name: 'lastName',
    label: t('admin:userForm.lastName')
  },
  {
    name: 'jobTitle',
    label: t('admin:userForm.jobTitle')
  },
  {
    name: 'userName',
    label: t('admin:userForm.idirUserName')
  },
  {
    name: 'keycloakEmail',
    label: t('admin:userForm.email')
  },
  {
    name: 'altEmail',
    label: t('admin:userForm.idirAltEmail'),
    optional: true
  },
  {
    name: 'phone',
    label: t('admin:userForm.phone'),
    optional: true
  },
  {
    name: 'mobilePhone',
    label: t('admin:userForm.mobilePhone'),
    optional: true
  }
]
export const bceidTextFields = (t) => [
  {
    name: 'firstName',
    label: t('admin:userForm.firstName')
  },
  {
    name: 'lastName',
    label: t('admin:userForm.lastName')
  },
  {
    name: 'jobTitle',
    label: t('admin:userForm.jobTitle'),
    optional: true
  },
  {
    name: 'userName',
    label: t('admin:userForm.bceidUserName')
  },
  {
    name: 'keycloakEmail',
    label: t('admin:userForm.bceidEmail')
  },
  {
    name: 'altEmail',
    label: t('admin:userForm.bceidAltEmail'),
    optional: true
  },
  {
    name: 'phone',
    label: t('admin:userForm.phone'),
    optional: true
  },
  {
    name: 'mobilePhone',
    label: t('admin:userForm.mobilePhone'),
    optional: true
  }
]

export const defaultValues = {
  userProfileID: '',
  firstName: '',
  lastName: '',
  jobTitle: '',
  userName: '',
  keycloakEmail: '',
  altEmail: '',
  phone: '',
  mobile: '',
  status: 'Active',
  adminRole: [],
  idirRole: '',
  bceidRoles: [],
  readOnly: ''
}

export const statusOptions = (t) => [
  {
    label: t('admin:userForm.activeLabel'),
    value: 'Active'
  },
  {
    label: t('admin:userForm.inactiveLabel'),
    value: 'Inactive'
  }
]

export const idirRoleOptions = (t) =>
  govRoles
    .map(
      (role, idx) =>
        idx > 1 && {
          label: role,
          header: role,
          text: t(`admin:userForm.${role.toLowerCase().replace(' ', '_')}`),
          value: role.toLowerCase()
        }
    )
    .filter((val) => val)

export const bceidRoleOptions = (t) =>
  nonGovRoles
    .map(
      (role, idx) =>
        !role.includes(roles.supplier) &&
        !role.includes(roles.read_only) && {
          label: role,
          header: role,
          text: t(`admin:userForm.${role.toLowerCase().replace(' ', '_')}`),
          value: role.toLowerCase()
        }
    )
    .filter((val) => val)
