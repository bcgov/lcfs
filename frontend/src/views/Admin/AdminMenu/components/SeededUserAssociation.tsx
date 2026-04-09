import { useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import {
  Autocomplete,
  Box,
  Checkbox,
  FormControlLabel,
  InputLabel,
  Paper,
  Stack,
  TextField
} from '@mui/material'
import Grid2 from '@mui/material/Grid2'
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import Loading from '@/components/Loading'
import { useTranslation } from 'react-i18next'
import {
  useSeededTestUsers,
  useUpdateUser,
  useResolveOrgName
} from '@/hooks/useUser'
import { useOrganizationNames } from '@/hooks/useOrganizations'
import { CONFIG } from '@/constants/config'
import { roles } from '@/constants/roles'
import { bceidRoleOptions } from '@/views/Users/AddEditUser/_schema'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import BCAlert, { BCAlert2 } from '@/components/BCAlert'
import type { BCAlert2Handle } from '@/components/BCAlert/BCAlert2'

interface SeededUserAssociationFormValues {
  selectedUserId: string
  selectedOrgId: string
  selectedRoles: string[]
  orgNameInput: string
  saltPhrase: string
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    padding: '7.5px 4px 7.5px 5px',
    background: 'white'
  },
  '& .MuiInputBase-root': {
    lineHeight: '1.4375em',
    height: '47px'
  }
}

const multiSelectFieldSx = {
  '& .MuiOutlinedInput-root': {
    background: 'white',
    minHeight: '47px',
    height: 'auto',
    alignItems: 'center',
    padding: '4px 4px 4px 5px'
  },
  '& .MuiInputBase-root': {
    lineHeight: '1.4375em',
    minHeight: '47px',
    height: 'auto'
  },
  '& .MuiAutocomplete-inputRoot': {
    alignItems: 'center'
  }
}

export const GOVERNMENT_ROLE_VALUES = new Set([
  roles.government.toLowerCase(),
  roles.administrator.toLowerCase(),
  roles.analyst.toLowerCase(),
  roles.compliance_manager.toLowerCase(),
  roles.director.toLowerCase(),
  roles.ia_analyst.toLowerCase(),
  roles.ia_manager.toLowerCase()
])

export const ORG_ALLOWED_ROLE_VALUES = new Set([
  roles.supplier.toLowerCase(),
  roles.manage_users.toLowerCase(),
  roles.transfers.toLowerCase(),
  roles.compliance_reporting.toLowerCase(),
  roles.signing_authority.toLowerCase(),
  roles.read_only.toLowerCase(),
  roles.ci_applicant.toLowerCase(),
  roles.ia_proponent.toLowerCase()
])

export const sanitizeOrgRoles = (roleNames: string[] = []): string[] =>
  roleNames.filter(
    (roleName) =>
      roleName &&
      ORG_ALLOWED_ROLE_VALUES.has(roleName) &&
      roleName !== roles.supplier.toLowerCase() &&
      !GOVERNMENT_ROLE_VALUES.has(roleName)
  )

export const isValidOrgRolePayload = (roleNames: string[] = []): boolean =>
  roleNames.every((roleName) => ORG_ALLOWED_ROLE_VALUES.has(roleName))

export const isSeededUserSelectable = (username = ''): boolean => {
  const normalizedUsername = username.trim().toLowerCase()
  const match = normalizedUsername.match(/^(lcfs|tfs)[\s_-]*0*([0-9]{1,2})$/)
  if (!match) {
    return false
  }

  const userNumber = Number(match[2])
  return userNumber >= 1 && userNumber <= 10
}

export const SeededUserAssociation = () => {
  const { t } = useTranslation(['admin', 'common'])
  const { hasRoles } = useCurrentUser()

  const environment = (CONFIG.ENVIRONMENT || '').toLowerCase()
  const seedEnv = environment.includes('test') ? 'test' : 'local'
  const isLocalEnvironment = ['local', 'development', 'dev'].includes(
    environment
  )

  const alertRef = useRef<BCAlert2Handle | null>(null)
  const [resolverResult, setResolverResult] = useState<any>(null)
  const [isTestUserOpen, setIsTestUserOpen] = useState(false)

  const { control, handleSubmit, setValue, setError, clearErrors } =
    useForm<SeededUserAssociationFormValues>({
      mode: 'onTouched',
      reValidateMode: 'onChange'
    })

  const selectedUserId = useWatch({ control, name: 'selectedUserId' })
  const selectedOrgId = useWatch({ control, name: 'selectedOrgId' })
  const orgNameInput = useWatch({ control, name: 'orgNameInput' })
  const saltPhrase = useWatch({ control, name: 'saltPhrase' })
  const selectedRoles = useWatch({ control, name: 'selectedRoles' }) || []

  const {
    data: seededUsers = [],
    isLoading: isUsersLoading,
    refetch: refetchSeededUsers
  } = useSeededTestUsers(seedEnv)

  const { data: organizations = [], isLoading: isOrgsLoading } =
    useOrganizationNames(null, { orgFilter: 'all' })

  const { mutate: updateUser, isPending } = useUpdateUser({
    onSuccess: () => {
      showAlert('success', t('admin:seededAssoc.success'))
      refetchSeededUsers()
    },
    onError: (error: any) => {
      showAlert(
        'error',
        error?.response?.data?.detail || t('common:submitError')
      )
    }
  })

  const { mutate: resolveOrgName, isPending: isResolvingOrgName } =
    useResolveOrgName({
      onSuccess: (response: any) => {
        const data = response?.data
        if (data?.resolved) {
          setResolverResult(data)
          showAlert('success', t('admin:seededAssoc.resolveSuccess'))
          return
        }
        setResolverResult(data || null)
        showAlert('error', data?.message || t('common:submitError'))
      },
      onError: (error: any) => {
        setResolverResult(null)
        showAlert(
          'error',
          error?.response?.data?.detail || t('common:submitError')
        )
      }
    })

  const seededUsersForSelection = useMemo(
    () =>
      seededUsers.filter((user: any) =>
        isSeededUserSelectable(user?.keycloakUsername || '')
      ),
    [seededUsers]
  )

  const selectedUser = useMemo(
    () =>
      seededUsersForSelection.find(
        (user: any) => String(user.userProfileId) === selectedUserId
      ),
    [seededUsersForSelection, selectedUserId]
  )

  const selectedOrganization = useMemo(
    () =>
      organizations.find(
        (organization: any) =>
          String(organization.organizationId) === selectedOrgId
      ) || null,
    [organizations, selectedOrgId]
  )

  const roleOptions = useMemo(() => bceidRoleOptions(t), [t])

  const selectedRoleOptions = useMemo(
    () => roleOptions.filter((option) => selectedRoles.includes(option.value)),
    [roleOptions, selectedRoles]
  )

  const showAlert = (severity: 'success' | 'error', message: string) => {
    alertRef.current?.triggerAlert({ severity, message })
  }

  const clearTransientState = () => {
    alertRef.current?.clearAlert()
    setResolverResult(null)
  }

  const getUserOptionLabel = (user: any) =>
    `${`${user?.firstName || ''} ${user?.lastName || ''}`.trim()} (${
      user?.keycloakUsername || ''
    })`

  const renderError = (message?: string) =>
    message ? (
      <BCTypography role="alert" color="error" variant="caption">
        {message}
      </BCTypography>
    ) : null

  useEffect(() => {
    const user = seededUsersForSelection.find(
      (candidate: any) => String(candidate.userProfileId) === selectedUserId
    )

    if (!user) {
      setValue('selectedRoles', [])
      setValue('selectedOrgId', '')
      return
    }

    const userRoles = sanitizeOrgRoles(
      user?.roles?.map((role: any) => role.name?.toLowerCase()) || []
    )
    setValue('selectedRoles', userRoles)
    setValue(
      'selectedOrgId',
      user?.organization?.organizationId?.toString() || ''
    )
    clearErrors(['selectedUserId', 'selectedOrgId', 'selectedRoles'])
  }, [selectedUserId, seededUsersForSelection, setValue, clearErrors])

  const handleAssociate = (data: SeededUserAssociationFormValues) => {
    if (!selectedUser || !data.selectedOrgId) {
      showAlert('error', t('admin:seededAssoc.validation'))
      if (!selectedUser) {
        setError('selectedUserId', {
          type: 'manual',
          message: t('admin:seededAssoc.validation')
        })
      }
      if (!data.selectedOrgId) {
        setError('selectedOrgId', {
          type: 'manual',
          message: t('admin:seededAssoc.validation')
        })
      }
      return
    }

    const payloadRoles = [
      roles.supplier.toLowerCase(),
      ...sanitizeOrgRoles(data.selectedRoles)
    ]
    if (!isValidOrgRolePayload(payloadRoles)) {
      showAlert('error', t('admin:seededAssoc.invalidRoleMix'))
      setError('selectedRoles', {
        type: 'manual',
        message: t('admin:seededAssoc.invalidRoleMix')
      })
      return
    }

    const payload = {
      userProfileId: selectedUser.userProfileId,
      title: selectedUser.title || '',
      firstName: selectedUser.firstName || '',
      lastName: selectedUser.lastName || '',
      keycloakUsername: selectedUser.keycloakUsername,
      keycloakEmail: selectedUser.keycloakEmail,
      email: selectedUser.email || null,
      phone: selectedUser.phone || null,
      mobilePhone: selectedUser.mobilePhone || null,
      isActive: selectedUser.isActive,
      organizationId: Number(data.selectedOrgId),
      roles: payloadRoles
    }

    clearErrors(['selectedUserId', 'selectedOrgId', 'selectedRoles'])
    alertRef.current?.clearAlert()
    updateUser({ userID: selectedUser.userProfileId, payload })
  }

  const handleResolveOrgName = () => {
    if (!orgNameInput.trim() || !saltPhrase.trim()) {
      showAlert('error', t('admin:seededAssoc.resolveValidation'))
      if (!orgNameInput.trim()) {
        setError('orgNameInput', {
          type: 'manual',
          message: t('admin:seededAssoc.resolveValidation')
        })
      }
      if (!saltPhrase.trim()) {
        setError('saltPhrase', {
          type: 'manual',
          message: t('admin:seededAssoc.resolveValidation')
        })
      }
      return
    }

    clearErrors(['orgNameInput', 'saltPhrase'])
    alertRef.current?.clearAlert()
    resolveOrgName({
      organizationName: orgNameInput.trim(),
      saltPhrase: saltPhrase.trim()
    })
  }

  if (isUsersLoading || isOrgsLoading) {
    return <Loading />
  }

  if (!hasRoles(roles.administrator)) {
    return <BCAlert severity="warning">{t('common:unauthorized')}</BCAlert>
  }

  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        border: 'none'
      }}
    >
      <Box component="form" onSubmit={handleSubmit(handleAssociate)} noValidate>
        <BCTypography variant="h5" my={1} color="primary">
          {t('admin:seededAssoc.title')}
        </BCTypography>
        <BCTypography variant="body2" mb={2}>
          {t('admin:seededAssoc.description', { env: seedEnv })}
        </BCTypography>

        <BCAlert2
          ref={alertRef}
          dismissible={true}
          noFade={true}
          sx={{ mb: 2 }}
        />

        <Grid2 container spacing={3} sx={{ alignItems: 'stretch' }}>
          <Grid2 size={{ xs: 12, md: 6 }}>
            <Box
              sx={{
                bgcolor: 'background.grey',
                p: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <Box
                sx={{
                  mr: { sm: 0, md: 4 },
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <BCTypography variant="h6" mb={2}>
                  {t('admin:seededAssoc.title')}
                </BCTypography>
                <Stack spacing={3}>
                  <Box>
                    <InputLabel htmlFor="testUser" sx={{ pb: 1 }}>
                      {t('admin:seededAssoc.user')}:
                    </InputLabel>
                    <Controller
                      name="selectedUserId"
                      control={control}
                      render={({ field, fieldState }) => (
                        <>
                          <Autocomplete
                            fullWidth
                            id="testUser"
                            data-test="test-user-select"
                            sx={fieldSx}
                            open={isTestUserOpen}
                            openOnFocus={false}
                            options={seededUsersForSelection}
                            value={selectedUser || null}
                            getOptionLabel={getUserOptionLabel}
                            isOptionEqualToValue={(option: any, value: any) =>
                              option?.userProfileId === value?.userProfileId
                            }
                            onOpen={() => setIsTestUserOpen(true)}
                            onClose={() => setIsTestUserOpen(false)}
                            onChange={(_, user: any | null) => {
                              clearTransientState()
                              setIsTestUserOpen(false)
                              field.onChange(
                                user ? String(user.userProfileId) : ''
                              )
                            }}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                error={!!fieldState.error}
                              />
                            )}
                          />
                          {renderError(fieldState.error?.message)}
                        </>
                      )}
                    />
                  </Box>

                  <Controller
                    name="selectedOrgId"
                    control={control}
                    render={({ field, fieldState }) => (
                      <>
                        <InputLabel htmlFor="selectedOrgId" sx={{ pb: 1 }}>
                          {t('admin:seededAssoc.organization')}:
                        </InputLabel>
                        <Autocomplete
                          fullWidth
                          sx={fieldSx}
                          options={organizations}
                          value={selectedOrganization}
                          getOptionLabel={(organization: any) =>
                            organization?.name || ''
                          }
                          isOptionEqualToValue={(option: any, value: any) =>
                            option?.organizationId === value?.organizationId
                          }
                          onChange={(_, organization: any | null) => {
                            alertRef.current?.clearAlert()
                            field.onChange(
                              organization
                                ? String(organization.organizationId)
                                : ''
                            )
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              id="selectedOrgId"
                              error={!!fieldState.error}
                            />
                          )}
                        />
                        {renderError(fieldState.error?.message)}
                      </>
                    )}
                  />

                  <Controller
                    name="selectedRoles"
                    control={control}
                    render={({ field, fieldState }) => (
                      <>
                        <InputLabel htmlFor="selectedRoles" sx={{ pb: 1 }}>
                          {t('admin:seededAssoc.roles')}:
                        </InputLabel>
                        <Autocomplete
                          multiple
                          fullWidth
                          id="selectedRoles"
                          sx={multiSelectFieldSx}
                          disableCloseOnSelect
                          options={roleOptions}
                          value={selectedRoleOptions}
                          getOptionLabel={(option) => option.label}
                          isOptionEqualToValue={(option, value) =>
                            option.value === value.value
                          }
                          onChange={(_, value) => {
                            alertRef.current?.clearAlert()
                            field.onChange(
                              sanitizeOrgRoles(
                                value.map((option) => option.value)
                              )
                            )
                          }}
                          renderOption={(props, option, { selected }) => (
                            <li {...props} key={option.value}>
                              <Checkbox
                                checked={selected}
                                sx={{ mr: 1 }}
                              />
                              <BCTypography variant="body2">
                                {option.label}
                              </BCTypography>
                            </li>
                          )}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              error={!!fieldState.error}
                            />
                          )}
                        />
                        {renderError(fieldState.error?.message)}
                      </>
                    )}
                  />

                  <FormControlLabel
                    control={<Checkbox checked disabled />}
                    label={t('admin:seededAssoc.supplierRoleNote')}
                    sx={{ ml: 0 }}
                  />

                  <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    flexWrap="wrap"
                  >
                    <BCButton
                      color="primary"
                      variant="contained"
                      type="submit"
                      disabled={isPending || isResolvingOrgName}
                    >
                      {t('admin:seededAssoc.associateBtn')}
                    </BCButton>
                  </Stack>
                </Stack>
              </Box>
            </Box>
          </Grid2>

          {isLocalEnvironment && (
            <Grid2 size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  bgcolor: 'background.grey',
                  p: 3,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <Box
                  sx={{
                    mr: { sm: 0, md: 4 },
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <BCTypography variant="h6" mb={2}>
                    {t('admin:seededAssoc.resolveBtn')}
                  </BCTypography>
                  <Stack spacing={3}>
                    <Controller
                      name="orgNameInput"
                      control={control}
                      render={({ field, fieldState }) => (
                        <Box>
                          <InputLabel htmlFor="orgNameInput" sx={{ pb: 1 }}>
                            {t('admin:seededAssoc.resolveOrgNameInput')}:
                          </InputLabel>
                          <TextField
                            {...field}
                            fullWidth
                            id="orgNameInput"
                            autoComplete="off"
                            value={field.value || ''}
                            error={!!fieldState.error}
                            helperText={
                              fieldState.error?.message ||
                              t('admin:seededAssoc.resolveOrgNameHelp')
                            }
                            onChange={(event) => {
                              clearTransientState()
                              field.onChange(event.target.value)
                            }}
                          />
                        </Box>
                      )}
                    />

                    <Controller
                      name="saltPhrase"
                      control={control}
                      render={({ field, fieldState }) => (
                        <Box>
                          <InputLabel htmlFor="saltPhrase" sx={{ pb: 1 }}>
                            {t('admin:seededAssoc.saltPhrase')}:
                          </InputLabel>
                          <TextField
                            {...field}
                            fullWidth
                            id="saltPhrase"
                            type="password"
                            autoComplete="off"
                            value={field.value || ''}
                            error={!!fieldState.error}
                            helperText={fieldState.error?.message || null}
                            onChange={(event) => {
                              clearTransientState()
                              field.onChange(event.target.value)
                            }}
                          />
                        </Box>
                      )}
                    />

                    <Box>
                      <BCButton
                      color="primary"
                      variant="outlined"
                      disabled={isPending || isResolvingOrgName}
                      onClick={handleResolveOrgName}
                    >
                      {t('admin:seededAssoc.resolveBtn')}
                      </BCButton>
                    </Box>

                    {resolverResult?.resolved && (
                      <BCTypography variant="body2">
                        {t('admin:seededAssoc.resolveResult', {
                          direction: resolverResult.direction,
                          original: resolverResult.originalName || '',
                          masked: resolverResult.maskedName || ''
                        })}
                      </BCTypography>
                    )}
                  </Stack>
                </Box>
              </Box>
            </Grid2>
          )}
        </Grid2>
      </Box>
    </Paper>
  )
}
