// External Modules
import { faArrowLeft, faFloppyDisk } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { yupResolver } from '@hookform/resolvers/yup'
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  InputLabel,
  Paper,
  Radio,
  RadioGroup,
  TextField
} from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { useMutation } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { schemaValidation } from './_schema'

// Internal Modules
import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import Loading from '@/components/Loading'
import { ROUTES } from '@/constants/routes'
import { useOrganization } from '@/hooks/useOrganization'
import { useApiService } from '@/services/useApiService'

// Component for adding a new organization
export const AddEditOrg = () => {
  const { t } = useTranslation(['common', 'org'])
  const navigate = useNavigate()
  const apiService = useApiService()
  const { orgID } = useParams()

  const { data, isFetched } = useOrganization(orgID, {
    enabled: !!orgID,
    retry: false
  })

  // State for controlling checkbox behavior
  const [sameAsLegalName, setSameAsLegalName] = useState(false)
  const [sameAsServiceAddress, setSameAsServiceAddress] = useState(false)

  // useForm hook setup with React Hook Form and Yup for form validation
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    trigger,
    reset,
    control
  } = useForm({
    resolver: yupResolver(schemaValidation)
  })

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

      reset({
        orgLegalName: data.name,
        orgOperatingName: data.operatingName,
        orgEmailAddress: data.email,
        orgPhoneNumber: data.phone,
        orgEDRMSRecord: data.edrmsRecord,
        hasEarlyIssuance: data.hasEarlyIssuance ? 'yes' : 'no',
        orgRegForTransfers:
          data.orgStatus.organizationStatusId === 2 ? '2' : '1',
        orgStreetAddress: data.orgAddress.streetAddress,
        orgAddressOther: data.orgAddress.addressOther,
        orgCity: data.orgAddress.city,
        orgPostalCodeZipCode: data.orgAddress.postalcodeZipcode,
        orgAttorneyStreetAddress: data.orgAttorneyAddress.streetAddress,
        orgAttorneyAddressOther: data.orgAttorneyAddress.addressOther,
        orgAttorneyCity: data.orgAttorneyAddress.city,
        orgAttorneyPostalCodeZipCode: data.orgAttorneyAddress.postalcodeZipcode
      })

      setSameAsLegalName(shouldSyncNames)
      setSameAsServiceAddress(shouldSyncAddress)
    }
  }, [isFetched, data, reset])

  // Watching form fields
  const orgLegalName = watch('orgLegalName')
  const orgStreetAddress = watch('orgStreetAddress')
  const orgAddressOther = watch('orgAddressOther')
  const orgCity = watch('orgCity')
  const orgPostalCodeZipCode = watch('orgPostalCodeZipCode')

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

  // Clear fields function
  const clearFields = useCallback(
    (fields) => {
      fields.forEach((fieldName) => {
        if (watch(fieldName)) {
          setValue(fieldName, '')
        }
      })
    },
    [setValue, watch]
  )

  // Function to render form error messages
  const renderError = (fieldName, sameAsField = null) => {
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

  // Prepare payload and call mutate function
  const onSubmit = async (data) => {
    const payload = {
      organizationId: orgID,
      name: data.orgLegalName,
      operatingName: data.orgOperatingName,
      email: data.orgEmailAddress,
      phone: data.orgPhoneNumber,
      edrmsRecord: data.orgEDRMSRecord,
      hasEarlyIssuance: data.hasEarlyIssuance === 'yes',
      organizationStatusId: parseInt(data.orgRegForTransfers),
      organizationTypeId: parseInt(data.orgSupplierType),
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
        streetAddress: data.orgAttorneyStreetAddress,
        addressOther: data.orgAttorneyAddressOther || '',
        city: data.orgAttorneyCity,
        provinceState: data.orgAttorneyProvince || 'BC',
        country: data.orgAttorneyCountry || 'Canada',
        postalcodeZipcode: data.orgAttorneyPostalCodeZipCode
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
    isError: isCreateOrgError
  } = useMutation({
    mutationFn: async (userData) =>
      await apiService.post('/organizations/create', userData),
    onSuccess: () => {
      // Redirect to Organization route on success
      navigate(ROUTES.ORGANIZATIONS, {
        state: {
          message: 'Organization has been successfully added.',
          severity: 'success'
        }
      })
    },
    onError: (error) => {
      // Error handling logic
      console.error('Error posting data:', error)
    }
  })

  const {
    mutate: updateOrg,
    isPending: isUpdateOrgPending,
    isError: isUpdateOrgError
  } = useMutation({
    mutationFn: async (payload) =>
      await apiService.put(`/organizations/${orgID}`, payload),
    onSuccess: () => {
      navigate(ROUTES.ORGANIZATIONS, {
        state: {
          message: 'Organization has been successfully updated.',
          severity: 'success'
        }
      })
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

  // Syncing logic for 'sameAsServiceAddress'
  useEffect(() => {
    if (sameAsServiceAddress) {
      setValueAndTriggerValidation(
        'orgAttorneyStreetAddress',
        watch('orgStreetAddress')
      )
      setValueAndTriggerValidation(
        'orgAttorneyAddressOther',
        watch('orgAddressOther')
      )
      setValueAndTriggerValidation('orgAttorneyCity', watch('orgCity'))
      setValueAndTriggerValidation(
        'orgAttorneyPostalCodeZipCode',
        watch('orgPostalCodeZipCode')
      )
    } else {
      if (watch('orgAttorneyStreetAddress') === orgStreetAddress) {
        clearFields(['orgAttorneyStreetAddress'])
      }
      if (watch('orgAttorneyAddressOther') === orgAddressOther) {
        clearFields(['orgAttorneyAddressOther'])
      }
      if (watch('orgAttorneyCity') === orgCity) {
        clearFields(['orgAttorneyCity'])
      }
      if (watch('orgAttorneyPostalCodeZipCode') === orgPostalCodeZipCode) {
        clearFields(['orgAttorneyPostalCodeZipCode'])
      }
    }
  }, [
    sameAsServiceAddress,
    orgStreetAddress,
    orgAddressOther,
    orgCity,
    orgPostalCodeZipCode,
    setValueAndTriggerValidation,
    clearFields
  ])

  // Conditional rendering for loading
  if (isCreateOrgPending || isUpdateOrgPending) {
    return <Loading message="Adding Organization..." />
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
        <BCAlert severity="error">{t('common:submitError')}</BCAlert>
      )}

      <BCTypography variant="h5" px={3}>
        {orgID ? t('org:editOrgTitle') : t('org:addOrgTitle')}
      </BCTypography>
      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        sx={{ mt: 1 }}
      >
        {/* Form Fields */}
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Box sx={{ bgcolor: 'background.grey', p: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ mr: { sm: 0, md: 4 } }}>
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
                      <Grid container>
                        <Grid item xs={6}>
                          <InputLabel htmlFor="orgOperatingName" sx={{ pb: 1 }}>
                            {t('org:operatingNameLabel')}:
                          </InputLabel>
                        </Grid>
                        <Grid
                          item
                          xs={6}
                          sx={{ display: 'flex', justifyContent: 'flex-end' }}
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
                              <BCTypography variant="body3">
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
                        {t('org:phoneNbrLabel')}:
                      </InputLabel>
                      <TextField
                        required
                        id="orgPhoneNumber"
                        data-test="orgPhoneNumber"
                        variant="outlined"
                        fullWidth
                        error={!!errors.orgPhoneNumber}
                        helperText={errors.orgPhoneNumber?.message}
                        {...register('orgPhoneNumber')}
                      />
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box>
                    <Box mb={2}>
                      <FormControl fullWidth>
                        <Grid container>
                          <Grid item xs={4}>
                            <FormLabel id="orgSupplierType" sx={{ pb: 1 }}>
                              <BCTypography variant="body3">
                                {t('org:supplierTypLabel')}:
                              </BCTypography>
                            </FormLabel>
                          </Grid>
                          <Grid item xs={8}>
                            <RadioGroup
                              row
                              id="orgSupplierType"
                              name="orgSupplierType"
                              defaultValue="1"
                            >
                              <FormControlLabel
                                value="1"
                                control={
                                  <Radio
                                    {...register('orgSupplierType')}
                                    data-test="orgSupplierType1"
                                  />
                                }
                                label={
                                  <BCTypography variant="body3">
                                    {t('supplier')}
                                  </BCTypography>
                                }
                              />
                            </RadioGroup>
                            {renderError('orgSupplierType')}
                          </Grid>
                        </Grid>
                      </FormControl>
                    </Box>
                    <Box mb={2}>
                      <FormControl fullWidth>
                        <Grid container>
                          <Grid item xs={4}>
                            <FormLabel id="orgRegForTransfers" sx={{ pb: 1 }}>
                              <BCTypography variant="body3">
                                {t('org:regTrnLabel')}:
                              </BCTypography>
                            </FormLabel>
                          </Grid>
                          <Grid item xs={8}>
                            <Controller
                              control={control}
                              name="orgRegForTransfers"
                              defaultValue=""
                              render={({ field }) => (
                                <RadioGroup
                                  row
                                  id="orgRegForTransfers"
                                  name="orgRegForTransfers"
                                  {...field}
                                >
                                  <FormControlLabel
                                    value="2"
                                    control={
                                      <Radio data-test="orgRegForTransfers2" />
                                    }
                                    label={
                                      <BCTypography variant="body3">
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
                                      <BCTypography variant="body3">
                                        {t('no')}
                                      </BCTypography>
                                    }
                                  />
                                </RadioGroup>
                              )}
                            >
                              /
                            </Controller>
                            {renderError('orgRegForTransfers')}
                          </Grid>
                        </Grid>
                      </FormControl>
                    </Box>
                    <Box mb={2}>
                      <FormControl fullWidth>
                        <Grid container>
                          <Grid item xs={4}>
                            <FormLabel id="orgRegForTransfers" sx={{ pb: 1 }}>
                              <BCTypography variant="body3">
                                {t('org:earlyIssuanceLabel')}:
                              </BCTypography>
                            </FormLabel>
                          </Grid>
                          <Grid item xs={8}>
                            <Controller
                              control={control}
                              name="hasEarlyIssuance"
                              defaultValue=""
                              render={({ field }) => (
                                <RadioGroup
                                  row
                                  id="hasEarlyIssuance"
                                  name="hasEarlyIssuance"
                                  sx={{ pt: 1 }}
                                  {...field}
                                >
                                  <FormControlLabel
                                    value="yes"
                                    control={
                                      <Radio data-test="hasEarlyIssuanceYes" />
                                    }
                                    label={
                                      <BCTypography variant="body3">
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
                                      <BCTypography variant="body3">
                                        {t('no')}
                                      </BCTypography>
                                    }
                                  />
                                </RadioGroup>
                              )}
                            >
                              /
                            </Controller>
                            {renderError('hasEarlyIssuance')}
                          </Grid>
                        </Grid>
                      </FormControl>
                    </Box>
                    <Box mb={2}>
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
                </Grid>
              </Grid>
            </Box>
          </Grid>
          <Grid item xs={12} md={6} data-test="service-address-section">
            <Box sx={{ bgcolor: 'background.grey', p: 3 }}>
              <BCTypography variant="h6" sx={{ pb: 7 }}>
                {t('org:serviceAddrLabel')}
              </BCTypography>
              <Box mb={2}>
                <InputLabel htmlFor="orgStreetAddress" sx={{ pb: 1 }}>
                  {t('org:streetAddrLabel')}:
                </InputLabel>
                <TextField
                  required
                  id="orgStreetAddress"
                  data-test="orgStreetAddress"
                  variant="outlined"
                  fullWidth
                  error={!!errors.orgStreetAddress}
                  helperText={errors.orgStreetAddress?.message}
                  {...register('orgStreetAddress')}
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
                  {t('org:cityLabel')}:
                </InputLabel>
                <TextField
                  required
                  id="orgCity"
                  data-test="orgCity"
                  variant="outlined"
                  fullWidth
                  error={!!errors.orgCity}
                  helperText={errors.orgCity?.message}
                  {...register('orgCity')}
                />
              </Box>
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
              <Box mb={2}>
                <InputLabel htmlFor="orgPostalCodeZipCode" sx={{ pb: 1 }}>
                  {t('org:poLabel')}:
                </InputLabel>
                <TextField
                  required
                  id="orgPostalCodeZipCode"
                  data-test="orgPostalCodeZipCode"
                  variant="outlined"
                  fullWidth
                  error={!!errors.orgPostalCodeZipCode}
                  helperText={errors.orgPostalCodeZipCode?.message}
                  {...register('orgPostalCodeZipCode')}
                />
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={6} data-test="attorney-address-section">
            <Box sx={{ bgcolor: 'background.grey', p: 3 }}>
              <BCTypography variant="h6" sx={{ pb: 2 }}>
                {t('org:bcAddrLabel')}
              </BCTypography>
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
                    <BCTypography variant="body3">
                      {t('org:sameAddrLabel')}
                    </BCTypography>
                  }
                />
              </Box>
              <Box mb={2}>
                <InputLabel htmlFor="orgAttorneyStreetAddress" sx={{ pb: 1 }}>
                  {t('org:streetAddrLabel')}:
                </InputLabel>
                <TextField
                  required
                  disabled={sameAsServiceAddress}
                  id="orgAttorneyStreetAddress"
                  data-test="orgAttorneyStreetAddress"
                  variant="outlined"
                  fullWidth
                  error={
                    !!errors.orgAttorneyStreetAddress && !sameAsServiceAddress
                  }
                  helperText={
                    sameAsServiceAddress
                      ? ''
                      : errors.orgAttorneyStreetAddress?.message
                  }
                  {...register('orgAttorneyStreetAddress')}
                />
              </Box>
              <Box mb={2}>
                <InputLabel htmlFor="orgAttorneyAddressOther" sx={{ pb: 1 }}>
                  {t('org:addrOthLabel')}:
                </InputLabel>
                <TextField
                  disabled={sameAsServiceAddress}
                  id="orgAttorneyAddressOther"
                  data-test="orgAttorneyAddressOther"
                  variant="outlined"
                  fullWidth
                  {...register('orgAttorneyAddressOther')}
                />
              </Box>
              <Box mb={2}>
                <InputLabel htmlFor="orgAttorneyCity" sx={{ pb: 1 }}>
                  {t('org:cityLabel')}:
                </InputLabel>
                <TextField
                  required
                  disabled={sameAsServiceAddress}
                  id="orgAttorneyCity"
                  data-test="orgAttorneyCity"
                  variant="outlined"
                  fullWidth
                  error={!!errors.orgAttorneyCity && !sameAsServiceAddress}
                  helperText={
                    sameAsServiceAddress ? '' : errors.orgAttorneyCity?.message
                  }
                  {...register('orgAttorneyCity')}
                />
              </Box>
              <Box mb={2}>
                <InputLabel htmlFor="orgAttorneyProvince" sx={{ pb: 1 }}>
                  {t('org:provinceLabel')}:
                </InputLabel>
                <TextField
                  disabled
                  id="orgAttorneyProvince"
                  data-test="orgAttorneyProvince"
                  variant="outlined"
                  defaultValue="BC"
                  {...register('orgAttorneyProvince')}
                />
              </Box>
              <Box mb={2}>
                <InputLabel htmlFor="orgAttorneyCountry" sx={{ pb: 1 }}>
                  {t('org:cntryLabel')}:
                </InputLabel>
                <TextField
                  disabled
                  id="orgAttorneyCountry"
                  data-test="orgAttorneyCountry"
                  variant="outlined"
                  defaultValue="Canada"
                  {...register('orgAttorneyCountry')}
                />
              </Box>
              <Box mb={2}>
                <InputLabel
                  htmlFor="orgAttorneyPostalCodeZipCode"
                  sx={{ pb: 1 }}
                >
                  {t('org:poLabel')}:
                </InputLabel>
                <TextField
                  required
                  disabled={sameAsServiceAddress}
                  id="orgAttorneyPostalCodeZipCode"
                  data-test="orgAttorneyPostalCodeZipCode"
                  variant="outlined"
                  fullWidth
                  error={
                    !!errors.orgAttorneyPostalCodeZipCode &&
                    !sameAsServiceAddress
                  }
                  helperText={
                    sameAsServiceAddress
                      ? ''
                      : errors.orgAttorneyPostalCodeZipCode?.message
                  }
                  {...register('orgAttorneyPostalCodeZipCode')}
                />
              </Box>
            </Box>
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12}>
            <Box
              sx={{
                bgcolor: 'background.grey',
                p: 3,
                display: 'flex',
                justifyContent: 'flex-end'
              }}
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
                onClick={() => navigate(ROUTES.ORGANIZATIONS)}
              >
                <BCTypography variant="subtitle2" textTransform="none">
                  {t('backBtn')}
                </BCTypography>
              </BCButton>
              <BCButton
                type="submit"
                variant="contained"
                size="medium"
                color="primary"
                data-test="saveOrganization"
                sx={{ ml: 2 }}
                startIcon={
                  <FontAwesomeIcon icon={faFloppyDisk} className="small-icon" />
                }
              >
                <BCTypography variant="button">{t('saveBtn')}</BCTypography>
              </BCButton>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  )
}
