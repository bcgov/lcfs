import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { saveUpdateUser } from '@/hooks/useUser'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { schemaValidation } from './_schema'

import colors from '@/themes/base/colors'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFloppyDisk, faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import BCButton from '@/components/BCButton'
import {
  Box,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2'
import { Label } from './components/Label'
import { IDIRSpecificFormFields } from './components/IDIRSpecificFormFields'
import { BCeIDSpecificFormFields } from './components/BCeIDSpecificFormFields'
import { BCeIDSpecificRoleFields } from './components/BCeIDSpecificRoleFields'
import { IDIRSpecificRoleFields } from './components/IDIRSpecificRoleFields'
import BCAlert from '@/components/BCAlert'
import { ROUTES } from '@/constants/routes'
import Loading from '@/components/Loading'

const dummy = {
  errors: {
    firstName: '',
    lastName: 'Example Last Name error text',
    jobTitle: '',
    IDIRUserName: '',
    BCeIDUserID: '',
    email: '',
    altEmail: '',
    phone: '',
    mobile: ''
  },
  gov: true,
  orgName: 'Fuel Supplier Canada Ltd.'
}

// switch between 'idir' and 'bceid'
export const AddEditUser = ({ userType = 'bceid', edit = false }) => {
  const navigate = useNavigate()
  const { t } = useTranslation(['common', 'admin'])
  const { userID } = useParams()
  const [formData, setFormData] = useState({
    userType,
    active: 'active',
    administrator: false,
    govRole: '',
    manageUsers: false,
    transfer: false,
    complianceReporting: false,
    signingAuthority: false,
    readOnly: false,
    firstName: '',
    lastName: '',
    jobTitle: '',
    BCeIDUserID: '',
    email: '',
    altEmail: '',
    phone: '',
    mobile: '',
    IDIRUserName: ''
  })

  // useForm hook setup with yup form validation
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors }
  } = useForm({ resolver: yupResolver(schemaValidation) })

  // watching form fields
  const firstName = watch('firstName')
  const lastName = watch('lastName')
  const jobTitle = watch('jobTitle')
  const IDIRUserName = watch('IDIRUserName')
  const BCeIDUserID = watch('BCeIDUserID')
  const email = watch('email')
  const altEmail = watch('altEmail')
  const phone = watch('phone')
  const mobile = watch('mobile')

  // Set value and trigger validation function
  const setValueAndTriggerValidation = useCallback(
    (fieldName, value) => {
      if (watch(fieldName) !== value) {
        setValue(fieldName, value)
        if (value.trim().length > 0) {
          trigger(fieldName)
        }
      }
    },
    [setValue, trigger, watch]
  )

  // Function to render form error messages
  const renderError = (fieldName, sameAsField = null) => {
    // If the sameAsField is provided and is true, hide errors for this field
    if (sameAsField && watch(sameAsField)) {
      return null
    }
    return (
      errors[fieldName] && (
        <Typography color="error" variant="caption">
          {errors[fieldName].message}
        </Typography>
      )
    )
  }

  // Prepare payload and call mutate function
  const onSubmit = async (data) => {
    const payload = {
      first_name: data.firstName,
      last_name: data.lastName,
      title: data.title,
      username: data.idirUserName,
      email: data.email,
      phone: data.phone,
      mobile_phone: data.mobile,
      is_active: data.status,
      roles: data.roles
    }
    mutate(payload)
  }

  // useMutation hook from React Query for handling API request
  const { mutate, isLoading, isError } = useMutation({
    mutationsFn: (data) => saveUpdateUser(userID, data),
    onSuccess: () => {
      // on success navigate somewhere
      navigate(ROUTES.ADMIN_USERS, {
        state: {
          message: 'User has been successfully saved.',
          severity: 'success'
        }
      })
    },
    onError: (error) => {
      // handle axios errors here
      console.error('Error posting data:', error)
    }
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleStatusChange = (e) => {
    const { value } = e.target
    if (value === 'active') {
      setFormData((prev) => ({ ...prev, active: value }))
    }
    if (value === 'inactive') {
      setFormData((prev) => ({
        ...prev,
        active: value,
        readOnly: false,
        manageUsers: false,
        transfer: false,
        complianceReporting: false,
        signingAuthority: false,
        administrator: false,
        govRole: ''
      }))
    }
  }

  const handleCheckbox = (e) => {
    const { checked, name } = e.target
    setFormData((prev) => ({ ...prev, [name]: checked, readOnly: false }))
  }

  const handleReadOnlyClick = () => {
    setFormData((prev) => ({
      ...prev,
      manageUsers: false,
      transfer: false,
      complianceReporting: false,
      signingAuthority: false,
      readOnly: true
    }))
  }

  if (isLoading) {
    return <Loading message="Adding user..." />
  }

  return (
    <div>
      {isError && <BCAlert severity="error" message={t('user:')} />}
      <Typography variant="h5" color={colors.primary.main} mb={2}>
        {userID ? 'Edit' : 'Add'} User&nbsp;
        {userType === 'bceid' && `to ${dummy.orgName}`}
      </Typography>
      <Grid2
        container
        columnSpacing={2.5}
        rowSpacing={3.5}
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        {/* Form fields */}
        <Grid2 xs={12} md={5} lg={4}>
          <Stack bgcolor={colors.background.grey} p={3} spacing={2} mb={3}>
            <Box>
              <Label htmlFor="firstName">{t('admin:userForm.firstName')}</Label>
              <TextField
                fullWidth
                required
                name="firstName"
                id="firstName"
                data-test="firstName"
                error={!!errors.firstName}
                helperText={errors.firstName?.message}
                {...register('firstName')}
              />
            </Box>
            <Box>
              <Label htmlFor="lastName">{t('admin:userForm.lastName')}</Label>
              <TextField
                fullWidth
                required
                name="lastName"
                id="lastName"
                data-test="lastName"
                error={!!errors.lastName}
                helperText={errors.lastName?.message}
                {...register('lastName')}
              />
            </Box>
            <Box>
              <Label htmlFor="jobTitle">{t('admin:userForm.jobTitle')}</Label>
              <TextField
                fullWidth
                required
                name="jobTitle"
                id="jobTitle"
                data-test="jobTitle"
                error={!!errors.jobTitle}
                helperText={errors.jobTitle?.message}
                {...register('jobTitle')}
              />
            </Box>
            {userType === 'idir' ? (
              <IDIRSpecificFormFields
                formData={formData}
                handleChange={handleChange}
                errors={errors}
                register={register}
              />
            ) : (
              <BCeIDSpecificFormFields
                formData={formData}
                handleChange={handleChange}
                errors={dummy.errors}
              />
            )}

            <Box>
              <Label htmlFor="phone">
                {t('admin:userForm.phone')}{' '}
                <span style={{ fontWeight: 'normal' }}>
                  ({t('admin:userForm.optional')})
                </span>
              </Label>
              <TextField
                fullWidth
                required
                name="phone"
                id="phone"
                data-test="phone"
                error={!!errors.phone}
                helperText={errors.phone?.message}
                {...register('phone')}
              />
            </Box>
            <Box>
              <Label htmlFor="mobile">
                {t('admin:userForm.mobilePhone')}{' '}
                <span style={{ fontWeight: 'normal' }}>
                  ({t('admin:userForm.optional')})
                </span>
              </Label>
              <TextField
                fullWidth
                required
                name="mobilePhone"
                id="mobilePhone"
                data-test="mobilePhone"
                error={!!errors.mobilePhone}
                helperText={errors.mobilePhone?.message}
                {...register('mobilePhone')}
              />
            </Box>
          </Stack>
          <Box
            bgcolor={colors.background.grey}
            p={3}
            display="flex"
            justifyContent="space-between"
          >
            <BCButton
              variant="outlined"
              size="medium"
              color="primary"
              sx={{
                backgroundColor: 'white.main'
              }}
              startIcon={
                <FontAwesomeIcon icon={faArrowLeft} className="small-icon" />
              }
              onClick={() => navigate(-1)}
            >
              <Typography variant="subtitle2" textTransform="none">
                {t('backBtn')}
              </Typography>
            </BCButton>
            <BCButton
              type="submit"
              variant="contained"
              size="medium"
              color="primary"
              data-test="saveOrganization"
              sx={{ ml: 2 }}
              data-testid="saveOrganization"
              startIcon={
                <FontAwesomeIcon icon={faFloppyDisk} className="small-icon" />
              }
            >
              <Typography variant="button">{t('saveBtn')}</Typography>
            </BCButton>
          </Box>
        </Grid2>
        <Grid2 xs={12} md={7} lg={6}>
          <Stack bgcolor={colors.background.grey} p={3} spacing={2} mb={3}>
            <Box>
              <Typography mb={1.5}>Status</Typography>
              <RadioGroup
                defaultValue="active"
                style={{
                  gap: 8,
                  marginTop: 8
                }}
                value={formData.active}
                name="active"
                onChange={handleStatusChange}
              >
                <FormControlLabel
                  value="active"
                  control={<Radio />}
                  label="Active, user can login to LCFS"
                />
                <FormControlLabel
                  value="inactive"
                  control={<Radio />}
                  label="Inactive, user cannot login to LCFS"
                />
              </RadioGroup>
            </Box>
            <Box>
              <Typography mb={1.5}>Roles</Typography>
              {userType === 'idir' ? (
                <IDIRSpecificRoleFields
                  formData={formData}
                  handleCheckbox={handleCheckbox}
                  handleChange={handleChange}
                />
              ) : (
                <BCeIDSpecificRoleFields
                  formData={formData}
                  handleCheckbox={handleCheckbox}
                  handleReadOnlyClick={handleReadOnlyClick}
                />
              )}
            </Box>
          </Stack>
        </Grid2>
      </Grid2>
    </div>
  )
}
