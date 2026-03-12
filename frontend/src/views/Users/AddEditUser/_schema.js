import * as Yup from 'yup'
import { roles } from '@/constants/roles'
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
    idirRole: Yup.string().test(
      'director-ia-conflict',
      'Director cannot be combined with IA analyst or IA manager roles.',
      function (idirRole) {
        const { iaRole } = this.parent
        if (idirRole === roles.director.toLowerCase() && iaRole) {
          return false
        }
        return true
      }
    ),
    iaRole: Yup.string(),
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
  iaRole: '',
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

const toOption = (role, t) => ({
  label: role,
  header: role,
  text: t(`admin:userForm.${role.toLowerCase().replace(/ /g, '_')}`),
  value: role.toLowerCase()
})

export const adminRoleOptions = (t) => [
  toOption(roles.administrator, t),
  {
    label: 'System Admin',
    header: 'System Admin',
    text: t('admin:userForm.system_admin'),
    // roles.system_admin is 'System Admin'; lowercase matches RoleEnum.SYSTEM_ADMIN.value.lower()
    value: roles.system_admin.toLowerCase()
  }
]

// Mutually exclusive: Director | Analyst | Compliance Manager
export const idirRoleOptions = (t) => [
  toOption(roles.director, t),
  toOption(roles.analyst, t),
  toOption(roles.compliance_manager, t)
]

// Mutually exclusive: IA Analyst | IA Manager. Cannot be combined with Director.
export const iaRoleOptions = (t) => [
  toOption(roles.ia_analyst, t),
  toOption(roles.ia_manager, t)
]

// IA Signer is excluded here — it is rendered separately, indented under IA Proponent
export const bceidRoleOptions = (t) =>
  [
    roles.manage_users,
    roles.transfers,
    roles.compliance_reporting,
    roles.signing_authority,
    roles.ci_applicant,
    roles.ia_proponent
  ].map((role) => toOption(role, t))

// Only shown when a government user edits a BCeID user
export const iaSignerOption = (t) => toOption(roles.ia_signer, t)
