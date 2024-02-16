import * as Yup from 'yup'
import { govRoles, nonGovRoles, roles } from '@/constants/roles'

// Schema for form validation
export const userInfoSchema = Yup.object({
  firstName: Yup.string().required('First name is required.'),
  lastName: Yup.string().required('Last name is required.'),
  jobTitle: Yup.string().required('Job title is required.'),
  userName: Yup.string().required('User name is required'),
  keycloakEmail: Yup.string()
    .required('Email Address is required.')
    .email('Please enter a valid Email Address.'),
  altEmail: Yup.string().optional().email('Please enter a valid Email Address.'),
  phone: Yup.string().optional(),
  mobilePhone: Yup.string().optional().nullable(),
  status: Yup.string(),
  adminRole: Yup.array(),
  idirRole: Yup.string(),
  bceidRoles: Yup.array(),
  readOnly: Yup.string(),
  // roles: Yup.string().required('One or more role is required.')
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
    label: t('admin:userForm.jobTitle')
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
  status: 'active',
}

export const statusOptions = (t) => [
  {
    label: t('admin:userForm.activeLabel'),
    value: 'active'
  },
  {
    label: t('admin:userForm.inactiveLabel'),
    value: 'inactive'
  }
]

export const idirRoleOptions = (t) => (
  govRoles.map(
    (role, idx) => (idx > 1 && {
      label: role,
      header: role,
      text: t(`admin:userForm.${role.toLowerCase().replace(' ', '_')}`),
      value: role.toLowerCase()
    })
  ).filter((val) => val)
)

export const bceidRoleOptions = (t) => (
  nonGovRoles.map((role, idx) => (
    (!role.includes(roles.supplier) && !role.includes(roles.read_only)) && (
      {
        label: role,
        header: role,
        text: t(`admin:userForm.${role.toLowerCase().replace(' ', '_')}`),
        value: role.toLowerCase()
      }
    ))).filter((val) => val)
)