import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { useForm, FormProvider } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
// hooks
import { saveUpdateUser } from '@/hooks/useUser'
import {
  userInfoSchema,
  idirTextFields,
  bceidTextFields,
  defaultValues,
  statusOptions
} from './_schema'
import { useApiService } from '@/services/useApiService'
import { ROUTES } from '@/constants/routes'
// components
import { BCFormRadio, BCFormText } from '@/components/BCForm'
import colors from '@/themes/base/colors'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFloppyDisk, faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import BCButton from '@/components/BCButton'
import { Box, Stack, Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2'
import BCAlert from '@/components/BCAlert'
import Loading from '@/components/Loading'
import { IDIRSpecificRoleFields } from './components/IDIRSpecificRoleFields'
import { BCeIDSpecificRoleFields } from './components/BCeIDSpecificRoleFields'

// switch between 'idir' and 'bceid'
export const AddEditUser = ({ userType = 'bceid', edit = false }) => {
  // User form hook and form validation
  const { handleSubmit, control, setValue, watch } = useForm({
    resolver: yupResolver(userInfoSchema),
    mode: 'onChange',
    defaultValues
  })
  const navigate = useNavigate()
  const apiService = useApiService()
  const { t } = useTranslation(['common', 'admin'])
  const { userID, orgID } = useParams()
  const [disabled, setDisabled] = useState(false)
  const textFields = useMemo(
    () => (orgID ? bceidTextFields(t) : idirTextFields(t)),
    [t]
  )
  const status = watch('status')
  const readOnly = watch('readOnly')
  useEffect(() => {
    if (status !== 'active' || readOnly === 'read only') {
      setDisabled(true)
    } else {
      setDisabled(false)
    }
  }, [status, readOnly])

  // Prepare payload and call mutate function
  const onSubmit = (data) => {
    const payload = {
      user_profile_id: userID,
      title: data.jobTitle,
      first_name: data.firstName,
      last_name: data.lastName,
      keycloak_username: data.userName,
      keycloak_email: data.keycloakEmail,
      email: data.altEmail === '' ? null : data.altEmail,
      phone: data.phone,
      mobile_phone: data.mobile,
      is_active: data.status === 'active',
      organization_id: orgID,
      roles: [
        ...data.adminRole,
        data.idirRole,
        data.readOnly,
        ...data.bceidRoles
      ]
    }
    console.log(payload)
    mutate(payload)
  }

  const onErrors = (error) => {
    console.log(error)
  }
  // useMutation hook from React Query for handling API request
  const { mutate, isPending, isError } = useMutation({
    mutationFn: async (payload) =>
      userID
        ? await apiService.put(`/users/${userID}`, payload)
        : await apiService.post('/users', payload),
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
      console.error('Error saving user:', error)
    }
  })
  if (isPending) {
    return <Loading message="Adding user..." />
  }

  return (
    <div>
      {isError && <BCAlert severity="error">{t('admin:errMsg')}</BCAlert>}
      <Typography variant="h5" color={colors.primary.main} mb={2}>
        {userID ? 'Edit' : 'Add'} user&nbsp;
        {userType === 'bceid' && `to Test Org`}
      </Typography>
      <form onSubmit={handleSubmit(onSubmit, onErrors)}>
        <FormProvider {...{ control, setValue }}>
          <Grid2 container columnSpacing={2.5} rowSpacing={3.5}>
            {/* Form fields */}
            <Grid2 xs={12} md={5} lg={4}>
              <Stack bgcolor={colors.background.grey} p={3} spacing={1} mb={3}>
                {textFields.map((field) => (
                  <BCFormText
                    key={field.name}
                    control={control}
                    label={field.label}
                    name={field.name}
                    optional={field.optional}
                  />
                ))}
              </Stack>
              <Box
                bgcolor={colors.background.grey}
                px={3}
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
                    <FontAwesomeIcon
                      icon={faArrowLeft}
                      className="small-icon"
                    />
                  }
                  onClick={() =>
                    navigate(
                      userType === 'idir'
                        ? ROUTES.ADMIN_USERS
                        : ROUTES.ORGANIZATIONS
                    )
                  }
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
                  data-test="saveUser"
                  sx={{ ml: 2 }}
                  data-testid="saveUser"
                  startIcon={
                    <FontAwesomeIcon
                      icon={faFloppyDisk}
                      className="small-icon"
                    />
                  }
                >
                  <Typography variant="button">{t('saveBtn')}</Typography>
                </BCButton>
              </Box>
            </Grid2>
            <Grid2 xs={12} md={7} lg={6}>
              <Stack bgcolor={colors.background.grey} p={3} spacing={2} mb={3}>
                <BCFormRadio
                  control={control}
                  name="status"
                  label="Status"
                  options={statusOptions(t)}
                />
                {userType === 'idir' ? (
                  <IDIRSpecificRoleFields
                    setValue={setValue}
                    disabled={disabled}
                    control={control}
                    t={t}
                  />
                ) : (
                  <BCeIDSpecificRoleFields
                    setValue={setValue}
                    disabled={disabled}
                    control={control}
                    status={status}
                    t={t}
                  />
                )}
              </Stack>
            </Grid2>
          </Grid2>
        </FormProvider>
      </form>
    </div>
  )
}
