import { PropTypes } from 'prop-types'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { useForm, FormProvider } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
// hooks
import { useUser } from '@/hooks/useUser'
import { useCurrentUser } from '@/hooks/useCurrentUser'
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
import { roles } from '@/constants/roles'
import { useOrganizationUser } from '@/hooks/useOrganization'

// switch between 'idir' and 'bceid'
export const AddEditUser = ({ userType }) => {
  const {
    data: currentUser,
    hasRoles,
    isLoading: isCurrentUserLoading
  } = useCurrentUser()
  const navigate = useNavigate()
  const apiService = useApiService()
  const { t } = useTranslation(['common', 'admin'])
  const { userId, orgId } = useParams()
  const [orgName, setOrgName] = useState('')

  const {
    data,
    isLoading: isUserLoading,
    isFetched: isUserFetched
  } = hasRoles(roles.supplier) && userId
    ? userId
      ? // eslint-disable-next-line react-hooks/rules-of-hooks
        useOrganizationUser({
          orgId: orgId || currentUser?.organization?.organizationId,
          userId
        })
      : { undefined, isLoading: false, isFetched: false }
    : // eslint-disable-next-line react-hooks/rules-of-hooks
      useUser({ id: +userId })

  // User form hook and form validation
  const form = useForm({
    resolver: yupResolver(userInfoSchema),
    mode: 'onChange',
    defaultValues
  })
  const { handleSubmit, control, setValue, watch, reset } = form
  const [disabled, setDisabled] = useState(false)
  const textFields = useMemo(
    () =>
      hasRoles(roles.supplier) || orgName || userType === 'bceid'
        ? bceidTextFields(t)
        : idirTextFields(t),
    [hasRoles, orgName, t]
  )
  const status = watch('status')
  const readOnly = watch('readOnly')
  const bceidRoles = watch('bceidRoles')

  useEffect(() => {
    if (status !== 'Active') {
      setDisabled(true)
    } else {
      setDisabled(false)
    }
  }, [status])

  useEffect(() => {
    if (readOnly === roles.read_only.toLocaleLowerCase()) {
      setValue('bceidRoles', [])
    }
  }, [readOnly])

  useEffect(() => {
    if (bceidRoles.length > 0) {
      setValue('readOnly', '')
    }
  }, [bceidRoles])

  useEffect(() => {
    if (isUserFetched && data) {
      const dataRoles = data?.roles
        .map((role) => role.name.toLowerCase())
        .filter(
          (r) =>
            r !== roles.government.toLocaleLowerCase() &&
            r !== roles.supplier.toLocaleLowerCase()
        )
      const userData = {
        keycloakEmail: data?.keycloakEmail,
        altEmail: data?.email || '',
        jobTitle: data?.title,
        firstName: data?.firstName,
        lastName: data?.lastName,
        userName: data?.keycloakUsername,
        phone: data?.phone,
        mobile: data?.mobilePhone,
        status: data?.isActive ? 'Active' : 'Inactive',
        readOnly: dataRoles
          .filter((r) => r === roles.read_only.toLocaleLowerCase())
          .join(''),
        adminRole: dataRoles.filter(
          (r) => r === roles.administrator.toLocaleLowerCase()
        ),
        idirRole: dataRoles
          .filter((r) => r !== roles.administrator.toLocaleLowerCase())
          .join(''),
        bceidRoles: dataRoles.includes(roles.read_only.toLocaleLowerCase())
          ? []
          : dataRoles
      }
      if (data.isGovernmentUser) {
        userData.bceidRoles = []
        userData.readOnly = ''
      } else {
        userData.adminRole = []
        userData.idirRole = ''
        setOrgName(data.organization?.name)
      }
      reset(userData)
    }
  }, [isUserFetched, data, reset])
  // Prepare payload and call mutate function
  const onSubmit = (data) => {
    const payload = {
      userProfileId: userId,
      title: data.jobTitle,
      firstName: data.firstName,
      lastName: data.lastName,
      keycloakUsername: data.userName,
      keycloakEmail: data.keycloakEmail,
      email: data.altEmail === '' ? null : data.altEmail,
      phone: data.phone,
      mobilePhone: data.mobile,
      isActive: data.status === 'Active',
      organizationId: orgId || currentUser.organizationId,
      roles:
        data.status === 'Active'
          ? [
              ...data.adminRole,
              ...(data.readOnly === '' ? data.bceidRoles : []),
              data.idirRole,
              data.readOnly
            ]
          : []
    }
    if (orgId || hasRoles(roles.supplier)) {
      payload.roles = [...payload.roles, roles.supplier.toLocaleLowerCase()]
    } else {
      payload.roles = [...payload.roles, roles.government.toLocaleLowerCase()]
    }
    mutate(payload)
  }

  const onErrors = (error) => {
    console.log(error)
  }
  // useMutation hook from React Query for handling API request
  const { mutate, isPending, isError } = useMutation({
    mutationFn: async (payload) => {
      if (hasRoles(roles.supplier)) {
        const orgId = orgId || currentUser.organization?.organizationId
        return userId
          ? await apiService.put(
              `/organization/${orgId}/users/${userId}`,
              payload
            )
          : await apiService.post(`/organization/${orgId}/users`, payload)
      }
      return userId
        ? await apiService.put(`/users/${userId}`, payload)
        : await apiService.post('/users', payload)
    },
    onSuccess: () => {
      // on success navigate somewhere
      if (hasRoles(roles.supplier)) {
        navigate(ROUTES.ORGANIZATION)
      } else if (orgId) {
        navigate(ROUTES.ORGANIZATIONS_VIEW.replace(':orgId', orgId), {
          state: {
            message: 'User has been successfully saved.',
            severity: 'success'
          }
        })
      } else {
        navigate(ROUTES.ADMIN_USERS, {
          state: {
            message: 'User has been successfully saved.',
            severity: 'success'
          }
        })
      }
    },
    onError: (error) => {
      // handle axios errors here
      console.error('Error saving user:', error)
    }
  })

  if (isUserLoading || isCurrentUserLoading) {
    return <Loading message="Loading..." />
  }

  if (isPending) {
    return <Loading message="Adding user..." />
  }

  return (
    <div>
      {isError && (
        <BCAlert severity="error" dismissible={true}>
          {t('common:submitError')}
        </BCAlert>
      )}
      <Typography variant="h5" color={colors.primary.main} mb={2}>
        {userId ? 'Edit' : 'Add'} user&nbsp;
        {userType === 'bceid' && `to ${orgName}`}
      </Typography>
      <form onSubmit={handleSubmit(onSubmit, onErrors)} id={'user-form'}>
        <FormProvider {...{ control, setValue }}>
          <Grid2 container columnSpacing={2.5} rowSpacing={0.5}>
            {/* Form fields */}
            <Grid2 item xs={12} md={5} lg={4}>
              <Stack bgcolor={colors.background.grey} p={3} spacing={1} mb={3}>
                {textFields.map((field) => (
                  <BCFormText
                    data-test={field.name}
                    key={field.name}
                    control={control}
                    label={field.label}
                    name={field.name}
                    optional={field.optional}
                  />
                ))}
              </Stack>
            </Grid2>
            <Grid2 item xs={12} md={7} lg={6}>
              <Stack bgcolor={colors.background.grey} p={3} spacing={2} mb={3}>
                <BCFormRadio
                  control={control}
                  name="status"
                  label="Status"
                  data-test="status"
                  options={statusOptions(t)}
                />
                {hasRoles(roles.supplier) || orgName || orgId ? (
                  <BCeIDSpecificRoleFields
                    form={form}
                    disabled={disabled}
                    status={status}
                    t={t}
                  />
                ) : (
                  <IDIRSpecificRoleFields
                    form={form}
                    disabled={disabled}
                    t={t}
                  />
                )}
              </Stack>
            </Grid2>
            <Grid2 item xs={12} md={5} lg={4}>
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
                  data-test="back-btn"
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
                    hasRoles(roles.supplier)
                      ? navigate(ROUTES.ORGANIZATION)
                      : navigate(
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
          </Grid2>
        </FormProvider>
      </form>
    </div>
  )
}

AddEditUser.defaultProps = {
  userType: 'idir'
}

AddEditUser.propTypes = {
  userType: PropTypes.oneOf(['idir', 'bceid'])
}
