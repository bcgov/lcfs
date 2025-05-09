import { PropTypes } from 'prop-types'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { useForm, FormProvider } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useUser, useDeleteUser } from '@/hooks/useUser'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  userInfoSchema,
  idirTextFields,
  bceidTextFields,
  defaultValues,
  statusOptions
} from './_schema'
import { useApiService } from '@/services/useApiService'
import { ROUTES, buildPath } from '@/routes/routes'
import { BCFormRadio, BCFormText } from '@/components/BCForm'
import colors from '@/themes/base/colors'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faFloppyDisk,
  faArrowLeft,
  faTrash
} from '@fortawesome/free-solid-svg-icons'
import BCButton from '@/components/BCButton'
import {
  Box,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip
} from '@mui/material'
import BCTypography from '@/components/BCTypography'
import Grid2 from '@mui/material/Grid2'
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
  const { userID, orgID } = useParams()
  const [orgName, setOrgName] = useState('')
  const [openConfirm, setOpenConfirm] = useState(false)

  const {
    data,
    isLoading: isUserLoading,
    isFetched: isUserFetched
  } = hasRoles(roles.supplier) && userID
    ? userID
      ? // eslint-disable-next-line react-hooks/rules-of-hooks
        useOrganizationUser(
          orgID || currentUser?.organization?.organizationId,
          userID,
          { enabled: !isCurrentUserLoading }
        )
      : { undefined, isLoading: false, isFetched: false }
    : // eslint-disable-next-line react-hooks/rules-of-hooks
      useUser(userID, { enabled: !!userID, retry: false })

  // Determine if user is safe to remove
  const safeToDelete = data?.isSafeToRemove
  const isEditingGovernmentUser = data?.isGovernmentUser || false
  const isCurrentUserGovernment = currentUser?.isGovernmentUser || false

  // User form hook and form validation
  const form = useForm({
    resolver: yupResolver(userInfoSchema(userType)),
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
    [hasRoles, orgName, t, userType]
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
      userProfileId: userID,
      title: data.jobTitle,
      firstName: data.firstName,
      lastName: data.lastName,
      keycloakUsername: data.userName,
      keycloakEmail: data.keycloakEmail,
      email: data.altEmail === '' ? null : data.altEmail,
      phone: data.phone,
      mobilePhone: data.mobile,
      isActive: data.status === 'Active',
      organizationId: orgID || currentUser.organizationId,
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
    if (orgID || hasRoles(roles.supplier)) {
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
        const orgId = orgID || currentUser.organization?.organizationId
        return userID
          ? await apiService.put(
              `/organization/${orgId}/users/${userID}`,
              payload
            )
          : await apiService.post(`/organization/${orgId}/users`, payload)
      }
      return userID
        ? await apiService.put(`/users/${userID}`, payload)
        : await apiService.post('/users', payload)
    },
    onSuccess: () => {
      // on success navigate somewhere
      if (hasRoles(roles.supplier)) {
        navigate(ROUTES.ORGANIZATION.ORG)
      } else if (orgID) {
        navigate(buildPath(ROUTES.ORGANIZATIONS.VIEW, { orgID }), {
          state: {
            message: 'User has been successfully saved.',
            severity: 'success'
          }
        })
      } else {
        navigate(ROUTES.ADMIN.USERS.LIST, {
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

  // Delete mutation hook (only used for BCeID users)
  const { mutate: deleteUser } = useDeleteUser()

  // Handler for confirming deletion
  const handleConfirmDelete = () => {
    deleteUser(userID, {
      onSuccess: () => {
        navigate(
          buildPath(ROUTES.ORGANIZATIONS.VIEW, {
            orgID: data?.organization?.organizationId
          }),
          {
            state: {
              message: t('admin:deleteUser.success'),
              severity: 'success'
            }
          }
        )
      },
      onError: (error) => {
        console.error('Error deleting user:', error)
      }
    })
    setOpenConfirm(false)
  }

  // Cancel deletion
  const handleCancelDelete = () => {
    setOpenConfirm(false)
  }

  // Handler for delete button click – opens confirmation dialog
  const handleDelete = () => {
    if (!isEditingGovernmentUser && isCurrentUserGovernment && safeToDelete) {
      setOpenConfirm(true)
    }
  }

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
      <BCTypography variant="h5" color={colors.primary.main} mb={2}>
        {userID ? 'Edit' : 'Add'} user&nbsp;
        {userType === 'bceid' && `to ${orgName}`}
      </BCTypography>
      <form onSubmit={handleSubmit(onSubmit, onErrors)} id={'user-form'}>
        <FormProvider {...{ control, setValue }}>
          <Grid2 container columnSpacing={2.5} rowSpacing={0.5}>
            {/* Form fields */}
            <Grid2
              size={{
                xs: 12,
                md: 5,
                lg: 4
              }}
            >
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
            <Grid2
              size={{
                xs: 12,
                md: 7,
                lg: 6
              }}
            >
              <Stack bgcolor={colors.background.grey} p={3} spacing={2} mb={3}>
                <BCFormRadio
                  control={control}
                  name="status"
                  label="Status"
                  data-test="status"
                  options={statusOptions(t)}
                />
                {hasRoles(roles.supplier) || orgName || orgID ? (
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
            <Grid2
              size={{
                xs: 12,
                md: 5,
                lg: 4
              }}
            >
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
                      ? navigate(ROUTES.ORGANIZATION.ORG)
                      : navigate(
                          userType === 'idir'
                            ? ROUTES.ADMIN.USERS.LIST
                            : ROUTES.ORGANIZATIONS.LIST
                        )
                  }
                >
                  <BCTypography variant="subtitle2" textTransform="none">
                    {t('backBtn')}
                  </BCTypography>
                </BCButton>
                {/* Only render delete button for BCeID users */}
                {userID &&
                  !isEditingGovernmentUser &&
                  isCurrentUserGovernment &&
                  (safeToDelete ? (
                    <BCButton
                      variant="outlined"
                      size="medium"
                      sx={{
                        backgroundColor: 'white.main',
                        borderColor: colors.error.main,
                        color: colors.error.main
                      }}
                      data-test="delete-user-btn"
                      startIcon={
                        <FontAwesomeIcon
                          icon={faTrash}
                          className="small-icon"
                        />
                      }
                      onClick={handleDelete}
                    >
                      <BCTypography variant="subtitle2" textTransform="none">
                        {t('admin:deleteUser.button')}
                      </BCTypography>
                    </BCButton>
                  ) : (
                    <Tooltip title={t('admin:deleteUser.notSafe')}>
                      <span>
                        <BCButton
                          variant="outlined"
                          size="medium"
                          sx={{
                            backgroundColor: 'white.main',
                            borderColor: colors.error.main,
                            color: colors.error.main,
                            '&.Mui-disabled': {
                              backgroundColor: 'white.main',
                              borderColor: colors.error.main,
                              color: colors.error.main,
                              opacity: 0.5, // slightly faded to indicate disabled state
                              cursor: 'not-allowed'
                            }
                          }}
                          disabled
                          data-test="delete-user-btn"
                          startIcon={
                            <FontAwesomeIcon
                              icon={faTrash}
                              className="small-icon"
                            />
                          }
                        >
                          <BCTypography
                            variant="subtitle2"
                            textTransform="none"
                          >
                            {t('admin:deleteUser.button')}
                          </BCTypography>
                        </BCButton>
                      </span>
                    </Tooltip>
                  ))}
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
                  <BCTypography variant="button">{t('saveBtn')}</BCTypography>
                </BCButton>
              </Box>
            </Grid2>
          </Grid2>
        </FormProvider>
      </form>

      {/* Confirmation Dialog for deletion */}
      <Dialog open={openConfirm} onClose={handleCancelDelete}>
        <DialogTitle>
          <BCTypography variant="h6" color={colors.primary.main}>
            {t('admin:deleteUser.confirmTitle')}
          </BCTypography>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <BCTypography variant="body5">
            {t('admin:deleteUser.confirmMessage')}
          </BCTypography>
        </DialogContent>
        <DialogActions>
          <BCButton
            variant="outlined"
            size="medium"
            color="primary"
            data-test="back-btn"
            sx={{
              backgroundColor: 'white.main'
            }}
            onClick={handleCancelDelete}
          >
            {t('cancelBtn')}
          </BCButton>
          <BCButton
            type="submit"
            variant="contained"
            size="medium"
            color="error"
            onClick={handleConfirmDelete}
          >
            {t('admin:deleteUser.button')}
          </BCButton>
        </DialogActions>
      </Dialog>
    </div>
  )
}

AddEditUser.defaultProps = {
  userType: 'idir'
}

AddEditUser.propTypes = {
  userType: PropTypes.oneOf(['idir', 'bceid'])
}
