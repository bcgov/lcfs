// External Modules
// External Modules
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import '@hookform/resolvers/yup'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormLabel from '@mui/material/FormLabel'
import Grid from '@mui/material/Grid'
import InputLabel from '@mui/material/InputLabel'
import Paper from '@mui/material/Paper'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import TextField from '@mui/material/TextField'
import '@mui/icons-material/Close'
import BCTypography from '@/components/BCTypography'
import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { createValidationSchema } from './_schema'
import type { BCAlert2Handle } from '@/components/BCAlert/BCAlert2'

// Internal Modules

// Internal Modules
import BCAlert, { BCAlert2 } from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import Loading from '@/components/Loading'
import '@/routes/routes'
import { useOrganization, useOrganizationTypes } from '@/hooks/useOrganization'
import type { OrganizationTypeData } from '@/hooks/useOrganization'
import { useApiService } from '@/services/useApiService'
import { AddressAutocomplete } from '@/components/BCForm/AddressAutocomplete'
import { BCFormCheckbox } from '@/components/BCForm/BCFormCheckbox'
import {
  orgAvailableRoleOptions,
  orgTypeDefaultRoles,
  suggestedRolesForTypes
} from '@/constants/organizationRoles'
import colors from '@/themes/base/colors'
import { getCurrentEarlyIssuanceYear } from '@/constants/common'
import ReferenceCompareBox from './ReferenceCompareBox'

// Component for adding a new organization
type AddEditOrgFormProps = {
  handleSaveSuccess?: (organizationId?: number | string) => void
  handleCancelEdit?: () => void
}

type OrgFormValues = {
  orgLegalName: string
  orgOperatingName: string
  orgEmailAddress: string
  orgPhoneNumber: string
  orgContactName: string
  orgTypeIds: string[]
  availableRoles: string[]
  orgRegForTransfers: string
  orgStreetAddress: string
  orgCity: string
  orgPostalCodeZipCode: string
  orgAddressOther: string
  orgProvince: string
  orgCountry: string
  orgHeadOfficeStreetAddress: string
  orgHeadOfficeAddressOther: string
  orgHeadOfficeCity: string
  orgHeadOfficeProvince: string
  orgHeadOfficeCountry: string
  orgHeadOfficePostalCodeZipCode: string
  orgEDRMSRecord: string
  recordsAddress: string
  hasEarlyIssuance: string
  orgCreditTradingEnabled?: string
}
type OrgTextField = Exclude<
  keyof OrgFormValues,
  'orgTypeIds' | 'availableRoles'
>
type OrganizationPayload = {
  organizationId: string | undefined
  name: string
  operatingName: string
  email: string
  phone: string
  contactName: string | null
  edrmsRecord: string
  recordsAddress: string
  hasEarlyIssuance: boolean
  organizationStatusId: number
  organizationTypeIds: number[]
  availableRoles: string[]
  creditTradingEnabled: boolean
  address: Record<string, string>
  attorneyAddress: Record<string, string>
}

export const AddEditOrgForm = ({
  handleSaveSuccess,
  handleCancelEdit
}: AddEditOrgFormProps) => {
  const { t } = useTranslation(['common', 'org'])
  useNavigate()
  const alertRef = useRef<BCAlert2Handle | null>(null)
  const alertProps = { dismissable: true, noFade: true }
  const location = useLocation()
  const organizationSnapshot = location.state?.organizationSnapshot
  const reportID = location.state?.reportID
  const [dismissedBoxes, setDismissedBoxes] = useState({
    organizationInfo: !reportID,
    serviceAddress: !reportID,
    headOfficeAddress: !reportID,
    recordsAddress: !reportID
  })
  const apiService = useApiService()
  const { orgID } = useParams()

  const { data, isFetched } = useOrganization(orgID, {
    enabled: !!orgID,
    retry: false
  })
  const { data: orgTypes } = useOrganizationTypes()
  const dismissBox = (boxType: keyof typeof dismissedBoxes) => {
    setDismissedBoxes((prev) => ({
      ...prev,
      [boxType]: true
    }))
  }
  // State for controlling checkbox behavior
  const [sameAsLegalName, setSameAsLegalName] = useState(false)
  const [sameAsServiceAddress, setSameAsServiceAddress] = useState(false)

  // State for tracking validation requirements from the selected org types
  const [requiresBCeID, setRequiresBCeID] = useState(true)

  // useForm hook setup with React Hook Form - validation handled in onSubmit
  const methods = useForm<OrgFormValues>({
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      orgLegalName: '',
      orgOperatingName: '',
      orgEmailAddress: '',
      orgPhoneNumber: '',
      orgContactName: '',
      orgTypeIds: ['1'],
      availableRoles: orgTypeDefaultRoles.fuel_supplier,
      orgRegForTransfers: '',
      orgStreetAddress: '',
      orgCity: '',
      orgPostalCodeZipCode: '',
      orgAddressOther: '',
      orgProvince: 'BC',
      orgCountry: 'Canada',
      orgHeadOfficeStreetAddress: '',
      orgHeadOfficeAddressOther: '',
      orgHeadOfficeCity: '',
      orgHeadOfficeProvince: '',
      orgHeadOfficeCountry: '',
      orgHeadOfficePostalCodeZipCode: '',
      orgEDRMSRecord: '',
      recordsAddress: '',
      hasEarlyIssuance: ''
    }
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    trigger,
    reset,
    control,
    clearErrors
  } = methods

  // Watch the organization type selections for changes
  const watchedOrgTypeIds = watch('orgTypeIds')

  // Effect to handle organization type changes and update validation
  // requirements: BCeID rules apply when ANY selected type is a BCeID type.
  useEffect(() => {
    if (watchedOrgTypeIds && orgTypes && orgTypes.length > 0) {
      const selectedTypes = orgTypes.filter(
        (type) =>
          type.organizationTypeId !== undefined &&
          watchedOrgTypeIds.includes(type.organizationTypeId.toString())
      )
      const newRequiresBCeID =
        selectedTypes.length === 0 ||
        selectedTypes.some((type) => type.isBceidUser)
      setRequiresBCeID(newRequiresBCeID)

      // Handle validation when switching organization types
      if (!newRequiresBCeID) {
        // For non-BCeID types, clear errors for fields that are now optional
        clearErrors([
          'orgPhoneNumber',
          'orgStreetAddress',
          'orgCity',
          'orgPostalCodeZipCode'
        ])
      }
    }
  }, [watchedOrgTypeIds, orgTypes, clearErrors])

  // When the analyst checks an organization type, suggest its typical roles
  // by adding them to "Roles available". Only reacts to types newly checked
  // since the last observation, so hydrating an existing organization (or
  // unchecking a type) never changes the role selection.
  const prevOrgTypeIdsRef = useRef<string[] | null>(null)
  useEffect(() => {
    if (!watchedOrgTypeIds || !orgTypes || orgTypes.length === 0) {
      return
    }
    const previous = prevOrgTypeIdsRef.current
    prevOrgTypeIdsRef.current = watchedOrgTypeIds
    if (previous === null) {
      return
    }
    const newlyChecked = watchedOrgTypeIds.filter(
      (id) => !previous.includes(id)
    )
    if (newlyChecked.length === 0) {
      return
    }
    const newKeys = orgTypes
      .filter(
        (type) =>
          type.organizationTypeId !== undefined &&
          newlyChecked.includes(type.organizationTypeId.toString())
      )
      .map((type) => type.orgType)
      .filter((type): type is string => typeof type === 'string')
    const currentRoles = watch('availableRoles') || []
    const additions = suggestedRolesForTypes(newKeys, currentRoles)
    if (additions.length > 0) {
      setValue('availableRoles', [...currentRoles, ...additions], {
        shouldDirty: true
      })
    }
  }, [watchedOrgTypeIds, orgTypes, watch, setValue])

  useEffect(() => {
    if (isFetched && data) {
      const shouldSyncNames = data.name === data.operatingName
      const shouldSyncAddress =
        data.orgAddress?.streetAddress ===
          data.orgAttorneyAddress?.streetAddress &&
        data.orgAddress?.addressOther ===
          data.orgAttorneyAddress?.addressOther &&
        data.orgAddress?.city === data.orgAttorneyAddress?.city &&
        data.orgAddress?.postalcodeZipcode ===
          data.orgAttorneyAddress?.postalcodeZipcode

      const hydratedOrgTypeIds = data.orgTypes?.length
        ? data.orgTypes
            .map((type) => type.organizationTypeId)
            .filter((id): id is number => typeof id === 'number')
            .map(String)
        : [
            data.organizationTypeId?.toString() ||
              data.orgType?.organizationTypeId?.toString() ||
              '1'
          ]
      prevOrgTypeIdsRef.current = hydratedOrgTypeIds

      reset({
        orgLegalName: data.name || '',
        orgOperatingName: data.operatingName || '',
        orgEmailAddress: data.email || '',
        orgPhoneNumber: data.phone || '',
        orgContactName: data.contactName || '',
        orgEDRMSRecord: data.edrmsRecord || '',
        recordsAddress: data.recordsAddress || '',
        hasEarlyIssuance: data.hasEarlyIssuance ? 'yes' : 'no',
        orgTypeIds: hydratedOrgTypeIds,
        availableRoles: data.availableRoles || [],
        orgRegForTransfers:
          data.orgStatus?.organizationStatusId === 2 ? '2' : '1',
        orgStreetAddress: data.orgAddress?.streetAddress || '',
        orgAddressOther: data.orgAddress?.addressOther || '',
        orgCity: data.orgAddress?.city || '',
        orgPostalCodeZipCode: data.orgAddress?.postalcodeZipcode || '',
        orgHeadOfficeStreetAddress:
          data.orgAttorneyAddress?.streetAddress || '',
        orgHeadOfficeAddressOther: data.orgAttorneyAddress?.addressOther || '',
        orgHeadOfficeCity: data.orgAttorneyAddress?.city || '',
        orgHeadOfficeProvince: data.orgAttorneyAddress?.provinceState || '',
        orgHeadOfficeCountry: data.orgAttorneyAddress?.country || '',
        orgHeadOfficePostalCodeZipCode:
          data.orgAttorneyAddress?.postalcodeZipcode || ''
      })

      setSameAsLegalName(shouldSyncNames)
      setSameAsServiceAddress(shouldSyncAddress)
    }
  }, [isFetched, data, reset, orgTypes])

  // Watching form fields
  const orgLegalName = watch('orgLegalName')
  const orgStreetAddress = watch('orgStreetAddress')
  const orgAddressOther = watch('orgAddressOther')
  const orgCity = watch('orgCity')
  const orgPostalCodeZipCode = watch('orgPostalCodeZipCode')

  // Set value and trigger validation function
  const setValueAndTriggerValidation = useCallback(
    (fieldName: OrgTextField, value: string) => {
      if (watch(fieldName) !== value) {
        setValue(fieldName, value)
        if (value && value.trim().length > 0) {
          trigger(fieldName)
        }
      }
    },
    [setValue, trigger, watch]
  )

  // Clear fields function
  const clearFields = useCallback(
    (fields: OrgTextField[]) => {
      fields.forEach((fieldName) => {
        if (watch(fieldName)) {
          setValue(fieldName, '')
        }
      })
    },
    [setValue, watch]
  )

  // Function to render form error messages
  const renderError = (
    fieldName: keyof OrgFormValues,
    sameAsField?: OrgTextField
  ) => {
    // If the sameAsField is provided and is true, hide errors for this field
    if (sameAsField && watch(sameAsField)) {
      return null
    }
    return (
      errors[fieldName] && (
        <BCTypography role="alert" color="error" variant="caption">
          {errors[fieldName].message}
        </BCTypography>
      )
    )
  }

  // Custom validation helper for conditional fields
  const validateConditionalFields = async (data: OrgFormValues) => {
    const validationSchema = createValidationSchema(
      (orgTypes || []).filter(
        (type): type is OrganizationTypeData & { organizationTypeId: number } =>
          typeof type.organizationTypeId === 'number'
      ),
      data.orgTypeIds
    )
    try {
      await validationSchema.validate(data, { abortEarly: false })
      return { isValid: true, errors: {} }
    } catch (validationErrors) {
      const formattedErrors: Partial<Record<keyof OrgFormValues, string>> = {}
      if (
        !(validationErrors instanceof Error) ||
        !('inner' in validationErrors) ||
        !Array.isArray(validationErrors.inner)
      ) {
        throw validationErrors
      }
      validationErrors.inner.forEach(
        (error: { path?: string; message: string }) => {
          if (error.path && error.path in data) {
            formattedErrors[error.path as keyof OrgFormValues] = error.message
          }
        }
      )
      return { isValid: false, errors: formattedErrors }
    }
  }

  // Prepare payload and call mutate function
  const onSubmit = async (data: OrgFormValues) => {
    // Perform custom validation based on the current organization type
    const validation = await validateConditionalFields(data)

    if (!validation.isValid) {
      // Set form errors for the failing fields
      Object.keys(validation.errors).forEach((fieldName) => {
        methods.setError(fieldName as keyof OrgFormValues, {
          type: 'manual',
          message: validation.errors[fieldName as keyof OrgFormValues]
        })
      })
      return // Don't submit if validation fails
    }

    const payload = {
      organizationId: orgID,
      name: data.orgLegalName,
      operatingName: data.orgOperatingName,
      email: data.orgEmailAddress,
      phone: data.orgPhoneNumber,
      contactName: data.orgContactName?.trim() || null,
      edrmsRecord: data.orgEDRMSRecord,
      recordsAddress: data.recordsAddress || '',
      hasEarlyIssuance: data.hasEarlyIssuance === 'yes',
      organizationStatusId: parseInt(data.orgRegForTransfers),
      organizationTypeIds: (data.orgTypeIds || []).map((id) => parseInt(id)),
      availableRoles: data.availableRoles || [],
      creditTradingEnabled: data.orgCreditTradingEnabled === 'yes',
      address: {
        name: data.orgOperatingName,
        streetAddress: data.orgStreetAddress,
        addressOther: data.orgAddressOther || '',
        city: data.orgCity,
        provinceState: data.orgProvince || 'BC',
        country: data.orgCountry || 'Canada',
        postalcodeZipcode: data.orgPostalCodeZipCode
      },
      attorneyAddress: {
        name: data.orgOperatingName,
        streetAddress: data.orgHeadOfficeStreetAddress,
        addressOther: data.orgHeadOfficeAddressOther || '',
        city: data.orgHeadOfficeCity,
        provinceState: data.orgHeadOfficeProvince || '',
        country: data.orgHeadOfficeCountry || '',
        postalcodeZipcode: data.orgHeadOfficePostalCodeZipCode
      }
    }

    if (orgID) {
      updateOrg(payload)
    } else {
      createOrg(payload)
    }
  }

  // useMutation hook from React Query for handling API request
  const {
    mutate: createOrg,
    isPending: isCreateOrgPending,
    isError: isCreateOrgError,
    error: createOrgError
  } = useMutation({
    mutationFn: async (userData: OrganizationPayload) =>
      await apiService.post('/organizations/create', userData),
    onSuccess: (response) => {
      // Redirect to Organization route on success
      if (handleSaveSuccess) {
        handleSaveSuccess(response?.data?.organizationId)
      }
    },
    onError: (error) => {
      // Error handling logic
      console.error('Error posting data:', error)
    }
  })

  const {
    mutate: updateOrg,
    isPending: isUpdateOrgPending,
    isError: isUpdateOrgError,
    error: updateOrgError
  } = useMutation({
    mutationFn: async (payload: OrganizationPayload) =>
      await apiService.put(`/organizations/${orgID}`, payload),
    onSuccess: () => {
      if (handleSaveSuccess) {
        handleSaveSuccess()
      }
    },
    onError: (error) => {
      console.error('Error posting data:', error)
    }
  })

  // Syncing logic for 'sameAsLegalName'
  useEffect(() => {
    if (sameAsLegalName) {
      setValueAndTriggerValidation('orgOperatingName', orgLegalName)
    } else {
      if (watch('orgOperatingName') === orgLegalName) {
        clearFields(['orgOperatingName'])
      }
    }
  }, [
    sameAsLegalName,
    orgLegalName,
    setValueAndTriggerValidation,
    clearFields,
    watch
  ])

  useEffect(() => {
    if (organizationSnapshot) {
      alertRef.current?.triggerAlert({
        severity: 'warning',
        message: `Address compare mode from compliance report ${reportID}`
      })
    }
  }, [organizationSnapshot, reportID])

  // Syncing logic for 'sameAsServiceAddress'
  useEffect(() => {
    if (sameAsServiceAddress) {
      setValueAndTriggerValidation(
        'orgHeadOfficeStreetAddress',
        watch('orgStreetAddress')
      )
      setValueAndTriggerValidation(
        'orgHeadOfficeAddressOther',
        watch('orgAddressOther')
      )
      setValueAndTriggerValidation('orgHeadOfficeCity', watch('orgCity'))
      setValueAndTriggerValidation(
        'orgHeadOfficePostalCodeZipCode',
        watch('orgPostalCodeZipCode')
      )
      setValueAndTriggerValidation(
        'orgHeadOfficeProvince',
        watch('orgProvince')
      )
      setValueAndTriggerValidation('orgHeadOfficeCountry', watch('orgCountry'))
    } else {
      if (watch('orgHeadOfficeStreetAddress') === orgStreetAddress) {
        clearFields(['orgHeadOfficeStreetAddress'])
      }
      if (watch('orgHeadOfficeAddressOther') === orgAddressOther) {
        clearFields(['orgHeadOfficeAddressOther'])
      }
      if (watch('orgHeadOfficeCity') === orgCity) {
        clearFields(['orgHeadOfficeCity'])
      }
      if (watch('orgHeadOfficePostalCodeZipCode') === orgPostalCodeZipCode) {
        clearFields(['orgHeadOfficePostalCodeZipCode'])
      }
    }
  }, [
    sameAsServiceAddress,
    orgStreetAddress,
    orgAddressOther,
    orgCity,
    orgPostalCodeZipCode,
    setValueAndTriggerValidation,
    clearFields,
    watch
  ])

  // Conditional rendering for loading
  if (isCreateOrgPending || isUpdateOrgPending) {
    return (
      <Loading
        message={
          isCreateOrgPending
            ? 'Adding organization...'
            : 'Updating organization...'
        }
      />
    )
  }

  // Form layout and structure
  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        border: 'none'
      }}
      data-test="addEditOrgContainer"
    >
      {/* Error Alert */}
      {(isCreateOrgError || isUpdateOrgError) && (
        <BCAlert severity="error">
          {(isAxiosError<{ detail?: string }>(updateOrgError)
            ? updateOrgError.response?.data?.detail
            : undefined) ||
            (isAxiosError<{ detail?: string }>(createOrgError)
              ? createOrgError.response?.data?.detail
              : undefined) ||
            t('common:submitError')}
        </BCAlert>
      )}
      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        sx={{ mt: 2 }}
      >
        {/* Form Fields */}
        <BCAlert2 ref={alertRef} {...alertProps} />
        <Grid container spacing={3} sx={{ alignItems: 'stretch' }}>
          <Grid item xs={12} md={6}>
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
                {organizationSnapshot && !dismissedBoxes.organizationInfo && (
                  <ReferenceCompareBox
                    title="Organization details"
                    data={[
                      {
                        label: t('org:legalNameLabel'),
                        value: organizationSnapshot.name
                      },
                      {
                        label: t('org:operatingNameLabel'),
                        value: organizationSnapshot.operatingName
                      },
                      {
                        label: t('org:emailAddrLabel'),
                        value: organizationSnapshot.email
                      },
                      {
                        label: t('org:phoneNbrLabel'),
                        value: organizationSnapshot.phone
                      }
                    ]}
                    onDismiss={() => dismissBox('organizationInfo')}
                    isDismissed={dismissedBoxes.organizationInfo}
                  />
                )}
                <Box mb={2}>
                  <InputLabel htmlFor="orgLegalName" sx={{ pb: 1 }}>
                    {t('org:legalNameLabel')}
                  </InputLabel>
                  <TextField
                    required
                    id="orgLegalName"
                    data-test="orgLegalName"
                    variant="outlined"
                    fullWidth
                    error={!!errors.orgLegalName}
                    helperText={errors.orgLegalName?.message}
                    {...register('orgLegalName')}
                  />
                </Box>
                <Box mb={2}>
                  <Grid container mb={0.5}>
                    <Grid item xs={6}>
                      <InputLabel htmlFor="orgOperatingName" sx={{ pb: 1 }}>
                        {t('org:operatingNameLabel')}:
                      </InputLabel>
                    </Grid>
                    <Grid
                      item
                      xs={6}
                      sx={{ display: 'flex', justifyContent: 'flex-start' }}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={sameAsLegalName}
                            onChange={(e) =>
                              setSameAsLegalName(e.target.checked)
                            }
                            data-test="sameAsLegalName"
                          />
                        }
                        label={
                          <BCTypography variant="subtitle2">
                            {t('org:sameAsLegalNameLabel')}
                          </BCTypography>
                        }
                      />
                    </Grid>
                  </Grid>
                  <TextField
                    required
                    disabled={sameAsLegalName}
                    id="orgOperatingName"
                    data-test="orgOperatingName"
                    variant="outlined"
                    fullWidth
                    error={!!errors.orgOperatingName}
                    helperText={errors.orgOperatingName?.message}
                    {...register('orgOperatingName')}
                  />
                </Box>
                <Box mb={2}>
                  <InputLabel htmlFor="orgEmailAddress" sx={{ pb: 1 }}>
                    {t('org:emailAddrLabel')}:
                  </InputLabel>
                  <TextField
                    required
                    id="orgEmailAddress"
                    data-test="orgEmailAddress"
                    variant="outlined"
                    fullWidth
                    error={!!errors.orgEmailAddress}
                    helperText={errors.orgEmailAddress?.message}
                    {...register('orgEmailAddress')}
                  />
                </Box>
                <Box mb={2}>
                  <InputLabel htmlFor="orgPhoneNumber" sx={{ pb: 1 }}>
                    {t('org:phoneNbrLabel')}
                    {requiresBCeID ? '' : ' (optional)'}:
                  </InputLabel>
                  <TextField
                    required={requiresBCeID}
                    id="orgPhoneNumber"
                    data-test="orgPhoneNumber"
                    variant="outlined"
                    fullWidth
                    error={!!errors.orgPhoneNumber}
                    helperText={errors.orgPhoneNumber?.message}
                    {...register('orgPhoneNumber')}
                  />
                </Box>
                <Box mb={2}>
                  <InputLabel htmlFor="orgContactName" sx={{ pb: 1 }}>
                    {t('org:contactNameLabelOptional')}:
                  </InputLabel>
                  <TextField
                    id="orgContactName"
                    data-test="orgContactName"
                    variant="outlined"
                    fullWidth
                    error={!!errors.orgContactName}
                    helperText={errors.orgContactName?.message}
                    {...register('orgContactName')}
                  />
                </Box>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                bgcolor: 'background.grey',
                p: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box mb={2} data-test="orgTypeSection">
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <BCFormCheckbox<OrgFormValues>
                        form={methods}
                        name="orgTypeIds"
                        label={`${t('org:orgTypeLabel')}:`}
                        options={(orgTypes || [])
                          .filter(
                            (type) => type.organizationTypeId !== undefined
                          )
                          .map((type) => ({
                            value: String(type.organizationTypeId),
                            label: type.description || type.orgType
                          }))}
                      />
                      {renderError('orgTypeIds')}
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <BCFormCheckbox<OrgFormValues>
                        form={methods}
                        name="availableRoles"
                        label={`${t('org:rolesAvailableLabel')}:`}
                        options={orgAvailableRoleOptions}
                      />
                    </Grid>
                  </Grid>
                </Box>
                <Box mb={2}>
                  <FormControl fullWidth>
                    <Grid container>
                      <Grid item xs={6}>
                        <FormLabel id="orgRegForTransfers" sx={{ pb: 1 }}>
                          <BCTypography variant="body4">
                            {t('org:regTrnLabel')}:
                          </BCTypography>
                        </FormLabel>
                      </Grid>
                      <Grid item xs={6} mt={0.5}>
                        <Controller
                          control={control}
                          name="orgRegForTransfers"
                          defaultValue=""
                          render={({ field }) => (
                            <RadioGroup row id="orgRegForTransfers" {...field}>
                              <FormControlLabel
                                value="2"
                                control={
                                  <Radio data-test="orgRegForTransfers2" />
                                }
                                label={
                                  <BCTypography variant="body4">
                                    {t('yes')}
                                  </BCTypography>
                                }
                              />
                              <FormControlLabel
                                value="1"
                                sx={{ ml: 2 }}
                                control={
                                  <Radio data-test="orgRegForTransfers1" />
                                }
                                label={
                                  <BCTypography variant="body4">
                                    {t('no')}
                                  </BCTypography>
                                }
                              />
                            </RadioGroup>
                          )}
                        ></Controller>
                        {renderError('orgRegForTransfers')}
                      </Grid>
                    </Grid>
                  </FormControl>
                </Box>
                <Box mb={2}>
                  <FormControl fullWidth>
                    <Grid container>
                      <Grid item xs={6} mt={0.5}>
                        <FormLabel id="orgRegForTransfers" sx={{ pb: 1 }}>
                          <BCTypography variant="body4">
                            {t('org:earlyIssuanceLabel', {
                              year: getCurrentEarlyIssuanceYear()
                            })}
                            :
                          </BCTypography>
                        </FormLabel>
                      </Grid>
                      <Grid item xs={6}>
                        <Controller
                          control={control}
                          name="hasEarlyIssuance"
                          defaultValue=""
                          render={({ field }) => (
                            <RadioGroup
                              row
                              id="hasEarlyIssuance"
                              sx={{ pt: 1 }}
                              {...field}
                            >
                              <FormControlLabel
                                value="yes"
                                control={
                                  <Radio data-test="hasEarlyIssuanceYes" />
                                }
                                label={
                                  <BCTypography variant="body4">
                                    {t('yes')}
                                  </BCTypography>
                                }
                              />
                              <FormControlLabel
                                value="no"
                                sx={{ ml: 2 }}
                                control={
                                  <Radio data-test="hasEarlyIssuanceNo" />
                                }
                                label={
                                  <BCTypography variant="body4">
                                    {t('no')}
                                  </BCTypography>
                                }
                              />
                            </RadioGroup>
                          )}
                        ></Controller>
                        {renderError('hasEarlyIssuance')}
                      </Grid>
                    </Grid>
                  </FormControl>
                </Box>
                <Box mb={2} sx={{ mt: 2 }}>
                  <InputLabel htmlFor="orgEDRMSRecord" sx={{ pb: 1 }}>
                    {t('org:edrmsLabel')}:
                  </InputLabel>
                  <TextField
                    required
                    id="orgEDRMSRecord"
                    data-test="orgEDRMSRecord"
                    variant="outlined"
                    fullWidth
                    error={!!errors.orgEDRMSRecord}
                    helperText={errors.orgEDRMSRecord?.message}
                    {...register('orgEDRMSRecord')}
                  />
                </Box>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={6} data-test="service-address-section">
            <Box
              sx={{
                bgcolor: 'background.grey',
                p: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <BCTypography
                variant="h6"
                sx={{
                  pb: dismissedBoxes.serviceAddress ? 7 : 2.2,
                  color: colors.primary.main
                }}
              >
                {t('org:serviceAddrLabel')}
              </BCTypography>
              {organizationSnapshot && !dismissedBoxes.serviceAddress && (
                <ReferenceCompareBox
                  title="Service address"
                  data={[{ value: organizationSnapshot.serviceAddress }]}
                  onDismiss={() => dismissBox('serviceAddress')}
                  isDismissed={dismissedBoxes.serviceAddress}
                />
              )}
              <Box
                sx={{
                  mb: 2,
                  mt: { lg: dismissedBoxes.serviceAddress ? 0 : 7 }
                }}
              >
                <InputLabel htmlFor="orgStreetAddress" sx={{ pb: 1 }}>
                  {t('org:streetAddrLabel')}
                  {requiresBCeID ? '' : ' (optional)'}:
                </InputLabel>
                <Controller
                  name="orgStreetAddress"
                  control={control}
                  render={({ field }) => (
                    <AddressAutocomplete
                      className="orgStreetAddress"
                      {...field}
                      onSelectAddress={(address) => {
                        if (typeof address === 'string') {
                          setValue('orgStreetAddress', address)
                        } else {
                          setValue(
                            'orgStreetAddress',
                            address.streetAddress || ''
                          )
                          setValue('orgCity', address.city || '')
                          setValue('orgPostalCodeZipCode', '')
                          // Trigger validation for the updated fields
                          trigger('orgStreetAddress')
                          trigger('orgCity')
                        }
                      }}
                    />
                  )}
                />
              </Box>
              <Box mb={2}>
                <InputLabel htmlFor="orgAddressOther" sx={{ pb: 1 }}>
                  {t('org:addrOthLabel')}:
                </InputLabel>
                <TextField
                  id="orgAddressOther"
                  data-test="orgAddressOther"
                  variant="outlined"
                  fullWidth
                  {...register('orgAddressOther')}
                />
              </Box>
              <Box mb={2}>
                <InputLabel htmlFor="orgCity" sx={{ pb: 1 }}>
                  {t('org:cityLabel')}
                  {requiresBCeID ? '' : ' (optional)'}:
                </InputLabel>
                <TextField
                  required={requiresBCeID}
                  id="orgCity"
                  data-test="orgCity"
                  variant="outlined"
                  fullWidth
                  error={!!errors.orgCity}
                  helperText={errors.orgCity?.message}
                  {...register('orgCity')}
                />
              </Box>
              <Box display="flex" gap={2} flexWrap="wrap">
                <Box mb={2}>
                  <InputLabel htmlFor="orgProvince" sx={{ pb: 1 }}>
                    {t('org:provinceLabel')}:
                  </InputLabel>
                  <TextField
                    disabled
                    id="orgProvince"
                    data-test="orgProvince"
                    variant="outlined"
                    defaultValue="BC"
                    {...register('orgProvince')}
                  />
                </Box>
                <Box mb={2}>
                  <InputLabel htmlFor="orgCountry" sx={{ pb: 1 }}>
                    {t('org:cntryLabel')}:
                  </InputLabel>
                  <TextField
                    disabled
                    id="orgCountry"
                    data-test="orgCountry"
                    variant="outlined"
                    defaultValue="Canada"
                    {...register('orgCountry')}
                  />
                </Box>
              </Box>
              <Box mb={2}>
                <InputLabel htmlFor="orgPostalCodeZipCode" sx={{ pb: 1 }}>
                  {t('org:poLabel')}
                  {requiresBCeID ? '' : ' (optional)'}:
                </InputLabel>
                <TextField
                  required={requiresBCeID}
                  id="orgPostalCodeZipCode"
                  data-test="orgPostalCodeZipCode"
                  variant="outlined"
                  fullWidth
                  error={!!errors.orgPostalCodeZipCode}
                  helperText={errors.orgPostalCodeZipCode?.message}
                  {...register('orgPostalCodeZipCode')}
                />
              </Box>
              <Box mb={2} mt={4}>
                <BCTypography
                  variant="h6"
                  sx={{ mb: 2, color: colors.primary.main }}
                >
                  {t('org:bcRecordLabel')}
                </BCTypography>
                {organizationSnapshot && !dismissedBoxes.headOfficeAddress && (
                  <ReferenceCompareBox
                    title="Head office address"
                    data={[{ value: organizationSnapshot.headOfficeAddress }]}
                    onDismiss={() => dismissBox('headOfficeAddress')}
                    isDismissed={dismissedBoxes.headOfficeAddress}
                  />
                )}
                <InputLabel
                  htmlFor="orgRecordsAddr"
                  sx={{
                    pb: 1,
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word'
                  }}
                >
                  {t('org:recordsAddrGuide')}:
                </InputLabel>
                <Controller
                  name="recordsAddress"
                  control={control}
                  render={({ field }) => (
                    <AddressAutocomplete
                      className="recordsAddress"
                      {...field}
                    />
                  )}
                />
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={6} data-test="head-office-address-section">
            <Box
              sx={{
                bgcolor: 'background.grey',
                p: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <BCTypography
                variant="h6"
                sx={{ pb: 2, color: colors.primary.main }}
              >
                {t('org:bcAddrLabel')}
              </BCTypography>
              {organizationSnapshot && !dismissedBoxes.recordsAddress && (
                <ReferenceCompareBox
                  title="Records address"
                  data={[{ value: organizationSnapshot.recordsAddress }]}
                  onDismiss={() => dismissBox('recordsAddress')}
                  isDismissed={dismissedBoxes.recordsAddress}
                />
              )}
              <Box mb={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={sameAsServiceAddress}
                      onChange={(e) =>
                        setSameAsServiceAddress(e.target.checked)
                      }
                    />
                  }
                  label={
                    <BCTypography variant="body4">
                      {t('org:sameAddrLabel')}
                    </BCTypography>
                  }
                />
              </Box>
              <Box mb={2}>
                <InputLabel htmlFor="orgHeadOfficeStreetAddress" sx={{ pb: 1 }}>
                  {t('org:streetAddrLabel')}:
                </InputLabel>
                <TextField
                  required
                  disabled={sameAsServiceAddress}
                  id="orgHeadOfficeStreetAddress"
                  data-test="orgHeadOfficeStreetAddress"
                  variant="outlined"
                  fullWidth
                  error={
                    !!errors.orgHeadOfficeStreetAddress && !sameAsServiceAddress
                  }
                  helperText={
                    sameAsServiceAddress
                      ? ''
                      : errors.orgHeadOfficeStreetAddress?.message
                  }
                  {...register('orgHeadOfficeStreetAddress')}
                />
              </Box>
              <Box mb={2}>
                <InputLabel htmlFor="orgHeadOfficeAddressOther" sx={{ pb: 1 }}>
                  {t('org:addrOthLabel')}:
                </InputLabel>
                <TextField
                  disabled={sameAsServiceAddress}
                  id="orgHeadOfficeAddressOther"
                  data-test="orgHeadOfficeAddressOther"
                  variant="outlined"
                  fullWidth
                  {...register('orgHeadOfficeAddressOther')}
                />
              </Box>
              <Box mb={2}>
                <InputLabel htmlFor="orgHeadOfficeCity" sx={{ pb: 1 }}>
                  {t('org:cityLabel')}:
                </InputLabel>
                <TextField
                  required
                  disabled={sameAsServiceAddress}
                  id="orgHeadOfficeCity"
                  data-test="orgHeadOfficeCity"
                  variant="outlined"
                  fullWidth
                  error={!!errors.orgHeadOfficeCity && !sameAsServiceAddress}
                  helperText={
                    sameAsServiceAddress
                      ? ''
                      : errors.orgHeadOfficeCity?.message
                  }
                  {...register('orgHeadOfficeCity')}
                />
              </Box>
              <Box display="flex" gap={2} flexWrap="wrap">
                <Box mb={2}>
                  <InputLabel htmlFor="orgHeadOfficeProvince" sx={{ pb: 1 }}>
                    {t('org:provinceStateLabel')}:
                  </InputLabel>
                  <TextField
                    disabled={sameAsServiceAddress}
                    id="orgHeadOfficeProvince"
                    data-test="orgHeadOfficeProvince"
                    variant="outlined"
                    {...register('orgHeadOfficeProvince')}
                  />
                </Box>
                <Box mb={2}>
                  <InputLabel htmlFor="orgHeadOfficeCountry" sx={{ pb: 1 }}>
                    {t('org:cntryLabel')}:
                  </InputLabel>
                  <TextField
                    disabled={sameAsServiceAddress}
                    id="orgHeadOfficeCountry"
                    data-test="orgHeadOfficeCountry"
                    variant="outlined"
                    {...register('orgHeadOfficeCountry')}
                  />
                </Box>
              </Box>
              <Box mb={2}>
                <InputLabel
                  htmlFor="orgHeadOfficePostalCodeZipCode"
                  sx={{ pb: 1 }}
                >
                  {t('org:poZipLabel')}:
                </InputLabel>
                <TextField
                  required
                  disabled={sameAsServiceAddress}
                  id="orgHeadOfficePostalCodeZipCode"
                  data-test="orgHeadOfficePostalCodeZipCode"
                  variant="outlined"
                  fullWidth
                  error={
                    !!errors.orgHeadOfficePostalCodeZipCode &&
                    !sameAsServiceAddress
                  }
                  helperText={
                    sameAsServiceAddress
                      ? ''
                      : errors.orgHeadOfficePostalCodeZipCode?.message
                  }
                  {...register('orgHeadOfficePostalCodeZipCode')}
                />
              </Box>
            </Box>
          </Grid>
          {/* Action Buttons */}
          <Grid item xs={12}>
            <Box
              sx={{
                bgcolor: 'background.white.main',
                p: 3,
                display: 'flex',
                justifyContent: 'flex-end',
                mt: 3
              }}
            >
              <BCButton
                type="submit"
                variant="contained"
                size="medium"
                color="primary"
                data-test="saveOrganization"
                startIcon={
                  <FontAwesomeIcon icon={faFloppyDisk} className="small-icon" />
                }
              >
                <BCTypography variant="button">{t('saveBtn')}</BCTypography>
              </BCButton>
              <BCButton
                variant="outlined"
                size="medium"
                color="primary"
                sx={{
                  backgroundColor: 'white.main',
                  ml: 2
                }}
                onClick={() => handleCancelEdit?.()}
              >
                <BCTypography variant="subtitle2" textTransform="none">
                  {t('cancelBtn')}
                </BCTypography>
              </BCButton>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  )
}
