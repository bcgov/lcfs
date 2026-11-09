import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import {
  format as formatDate,
  isValid as isValidDate,
  parseISO
} from 'date-fns'
import { debounce } from 'lodash'
import isEqual from 'lodash/isEqual'
import * as Yup from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'
import Grid2 from '@mui/material/Grid2'
import EditIcon from '@mui/icons-material/Edit'
import InfoIcon from '@mui/icons-material/Info'
import UploadFileIcon from '@mui/icons-material/UploadFile'

import BCAlertRoot from '@/components/BCAlert/BCAlertRoot'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'
import DocumentPreviewButton from '@/components/Documents/DocumentPreviewButton'
import {
  useCIFacilityLocationSearch,
  useGetCIApplicationFacilities
} from '@/hooks/useCIApplication'
import colors from '@/themes/base/colors'
import { getDocumentDisplayName } from '@/utils/documents'

const DATE_FORMAT = 'yyyy-MM-dd'
const EFFECTIVE_DATE_NOTICE_ID = 'proposedFuelCodeEffectiveDateNotice'
const FILL_OPTIONS = { shouldDirty: true, shouldValidate: true }
const FACILITY_FIELDS = [
  'facilityName',
  'facilityCity',
  'facilityProvinceState',
  'facilityCountry',
  'facilityNameplateCapacity',
  'facilityNameplateCapacityUnit',
  'facilityContactName',
  'facilityContactEmail'
]

const isFacilityComplete = (facility) =>
  Boolean(
    facility?.name?.trim() &&
    facility?.city?.trim() &&
    facility?.provinceState?.trim() &&
    facility?.country?.trim() &&
    Number(facility?.nameplateCapacity) > 0 &&
    facility?.nameplateCapacityUnit &&
    facility?.contactName?.trim() &&
    facility?.contactEmail?.trim()
  )

// Match plain TextField padding
const LOCATION_AUTOCOMPLETE_SX = {
  '& .MuiOutlinedInput-root': {
    padding: '0 !important'
  },
  '& .MuiAutocomplete-input': {
    padding: '12px !important'
  }
}

// Fetches suggestions from the backend as user types; cascade-fills on select.
const FacilityLocationAutocomplete = ({
  id,
  value,
  onChange,
  onSelectSuggestion,
  onBlur,
  error,
  helperText,
  disabled,
  searchType, // 'city' | 'province' | 'country'
  inputRef
}) => {
  const [debouncedSearch, setDebouncedSearch] = useState(value || '')
  const autofillToken = `lcfs-no-autofill-${id}`

  const debouncedSetSearch = useMemo(
    () => debounce((v) => setDebouncedSearch(v), 500),
    []
  )

  const searchParams = useMemo(
    () => ({
      city: searchType === 'city' ? debouncedSearch : undefined,
      province: searchType === 'province' ? debouncedSearch : undefined,
      country: searchType === 'country' ? debouncedSearch : undefined
    }),
    [searchType, debouncedSearch]
  )

  const { data: options = [] } = useCIFacilityLocationSearch(searchParams)

  return (
    <Autocomplete
      id={id}
      freeSolo
      options={options}
      filterOptions={(x) => x}
      openOnFocus
      forcePopupIcon={false}
      disableClearable
      disabled={disabled}
      inputValue={value ?? ''}
      value={null}
      sx={LOCATION_AUTOCOMPLETE_SX}
      ListboxProps={{ style: { maxHeight: 320 } }}
      noOptionsText={null}
      componentsProps={{
        paper: { sx: { display: options.length === 0 ? 'none' : 'block' } }
      }}
      onInputChange={(_event, newInputValue, reason) => {
        if (reason === 'input') {
          onChange(newInputValue)
          debouncedSetSearch(newInputValue)
        } else if (reason === 'clear') {
          onChange('')
          setDebouncedSearch('')
        }
      }}
      onChange={(_event, newValue, reason) => {
        if (reason === 'selectOption' && typeof newValue === 'string') {
          onSelectSuggestion?.(newValue)
        } else if (reason === 'clear') {
          onChange('')
        } else if (typeof newValue === 'string') {
          onChange(newValue)
        }
      }}
      onBlur={onBlur}
      renderInput={(params) => (
        <TextField
          {...params}
          id={id}
          name={autofillToken}
          inputRef={inputRef}
          required
          variant="outlined"
          fullWidth
          error={error}
          helperText={helperText}
          autoComplete={autofillToken}
          onFocus={(event) => {
            event.target.setAttribute('autocomplete', autofillToken)
            const term = (value || '').trim()
            if (term && term !== debouncedSearch) setDebouncedSearch(term)
            params.inputProps?.onFocus?.(event)
          }}
          inputProps={{
            ...params.inputProps,
            id,
            name: autofillToken,
            'data-test': id,
            autoComplete: autofillToken,
            autoCorrect: 'off',
            autoCapitalize: 'off',
            spellCheck: false,
            'data-lpignore': 'true',
            'data-1p-ignore': 'true',
            'data-form-type': 'other'
          }}
        />
      )}
    />
  )
}

const stringToDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return isValidDate(value) ? value : null
  const parsed = parseISO(value)
  return isValidDate(parsed) ? parsed : null
}

const dateToString = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value
  return isValidDate(value) ? formatDate(value, DATE_FORMAT) : ''
}

const splitLocationParts = (value) =>
  String(value ?? '')
    .split(',')
    .map((part) => part.trim())

const buildValidationSchema = (t) =>
  Yup.object({
    fuelProductionFacilityId: Yup.mixed().nullable(),
    facilityName: Yup.string()
      .trim()
      .required(t('carbonIntensity:step1.validation.facilityNameRequired')),
    facilityCity: Yup.string()
      .trim()
      .required(t('carbonIntensity:step1.validation.cityRequired')),
    facilityProvinceState: Yup.string()
      .trim()
      .required(t('carbonIntensity:step1.validation.provinceStateRequired')),
    facilityCountry: Yup.string()
      .trim()
      .required(t('carbonIntensity:step1.validation.countryRequired')),
    facilityNameplateCapacity: Yup.number()
      .typeError(t('carbonIntensity:step1.validation.capacityRequired'))
      .required(t('carbonIntensity:step1.validation.capacityRequired'))
      .positive(t('carbonIntensity:step1.validation.capacityPositive'))
      .integer(t('carbonIntensity:step1.validation.capacityPositive')),
    facilityNameplateCapacityUnit: Yup.string().required(
      t('carbonIntensity:step1.validation.uomRequired')
    ),
    facilityContactName: Yup.string()
      .trim()
      .required(t('carbonIntensity:step1.validation.contactNameRequired')),
    facilityContactEmail: Yup.string()
      .trim()
      .required(t('carbonIntensity:step1.validation.contactEmailRequired'))
      .email(t('carbonIntensity:step1.validation.contactEmailInvalid')),
    proposedFuelCodeEffectiveDate: Yup.string().nullable()
  })

const toFormValues = (data) => {
  const facility = data?.fuelProductionFacility
  return {
    fuelProductionFacilityId: data?.fuelProductionFacilityId ?? '',
    facilityName: facility?.name ?? data?.facilityName ?? '',
    facilityCity: data?.facilityCity ?? '',
    facilityProvinceState: data?.facilityProvinceState ?? '',
    facilityCountry: data?.facilityCountry ?? '',
    facilityNameplateCapacity: data?.facilityNameplateCapacity ?? '',
    facilityNameplateCapacityUnit: data?.facilityNameplateCapacityUnit ?? '',
    facilityContactName:
      facility?.contactName ?? data?.facilityContactName ?? '',
    facilityContactEmail:
      facility?.contactEmail ?? data?.facilityContactEmail ?? '',
    proposedFuelCodeEffectiveDate: data?.proposedFuelCodeEffectiveDate ?? ''
  }
}

const toApiPayload = (values) => ({
  fuelProductionFacilityId: values.fuelProductionFacilityId
    ? Number(values.fuelProductionFacilityId)
    : null,
  facilityName: values.facilityName?.trim(),
  facilityCity: values.facilityCity?.trim(),
  facilityProvinceState: values.facilityProvinceState?.trim(),
  facilityCountry: values.facilityCountry?.trim(),
  facilityNameplateCapacity: Number(values.facilityNameplateCapacity),
  facilityNameplateCapacityUnit: values.facilityNameplateCapacityUnit || null,
  facilityContactName: values.facilityContactName?.trim(),
  facilityContactEmail: values.facilityContactEmail?.trim(),
  proposedFuelCodeEffectiveDate: values.proposedFuelCodeEffectiveDate || null
})

export const ApplicationInformationStep = forwardRef(
  (
    {
      ciApplication,
      organization,
      unitsOfMeasure = [],
      onSave,
      onDelete,
      isSaving = false,
      readOnly = false,
      showEffectiveDateNotice = false,
      // The "confirm your organization details" note is for BCeID
      // (supplier) users; IDIR reviewers are not confirming anything.
      showOrgInfoConfirmation = false
    },
    ref
  ) => {
    const { t } = useTranslation(['common', 'carbonIntensity'])
    const autofillTrapRef = useRef(null)
    const [documentDialogOpen, setDocumentDialogOpen] = useState(false)
    // Facility section modes: 'select' (pick an existing facility),
    // 'form' (edit an incomplete/selected facility or add a new one) and
    // 'summary' (facility saved on the application). User actions override
    // the default until the application is saved again.
    const [modeOverride, setModeOverride] = useState(null)
    const [selectError, setSelectError] = useState('')
    // Facilities are already scoped to the caller's organization by the API.
    const {
      data: facilities = [],
      isLoading: isLoadingFacilities,
      isError: isFacilityListError
    } = useGetCIApplicationFacilities({
      enabled: !readOnly
    })

    const validationSchema = buildValidationSchema(t)
    const form = useForm({
      resolver: yupResolver(validationSchema),
      mode: 'onTouched',
      defaultValues: toFormValues(ciApplication)
    })

    const { control, handleSubmit, reset, setValue, watch, formState } = form
    const previousSeed = useRef(null)
    const selectedFacilityId = Number(watch('fuelProductionFacilityId') || 0)
    // The application's embedded facility is the freshest source for the
    // saved facility (e.g. documents); fall back to the org list otherwise.
    const savedFacility = ciApplication?.fuelProductionFacility
    const selectedFacility =
      (savedFacility?.fuelProductionFacilityId === selectedFacilityId
        ? savedFacility
        : null) ||
      facilities.find(
        (facility) => facility.fuelProductionFacilityId === selectedFacilityId
      ) ||
      null

    // Selecting an existing facility links it and fills its saved details.
    const applyFacility = useCallback(
      (facility) => {
        setValue(
          'fuelProductionFacilityId',
          facility.fuelProductionFacilityId,
          FILL_OPTIONS
        )
        setValue('facilityName', facility.name || '', FILL_OPTIONS)
        setValue('facilityCity', facility.city || '', FILL_OPTIONS)
        setValue(
          'facilityProvinceState',
          facility.provinceState || '',
          FILL_OPTIONS
        )
        setValue('facilityCountry', facility.country || '', FILL_OPTIONS)
        setValue(
          'facilityNameplateCapacity',
          facility.nameplateCapacity || '',
          FILL_OPTIONS
        )
        setValue(
          'facilityNameplateCapacityUnit',
          facility.nameplateCapacityUnit || '',
          FILL_OPTIONS
        )
        setValue(
          'facilityContactName',
          facility.contactName || '',
          FILL_OPTIONS
        )
        setValue(
          'facilityContactEmail',
          facility.contactEmail || '',
          FILL_OPTIONS
        )
      },
      [setValue]
    )

    const handleSelectFacility = useCallback(
      (facility) => {
        setSelectError('')
        applyFacility(facility)
        // Complete facilities stay in select mode until save; incomplete
        // ones open the form so the gaps can be filled in.
        setModeOverride(isFacilityComplete(facility) ? 'select' : 'form')
      },
      [applyFacility]
    )

    const handleAddNewFacility = useCallback(() => {
      setSelectError('')
      setValue('fuelProductionFacilityId', '', { shouldDirty: true })
      for (const name of FACILITY_FIELDS) {
        setValue(name, '', { shouldDirty: true })
      }
      setModeOverride('form')
    }, [setValue])

    useEffect(() => {
      const seed = {
        id: ciApplication?.ciApplicationId,
        values: toFormValues(ciApplication)
      }
      if (!isEqual(previousSeed.current, seed)) {
        previousSeed.current = seed
        reset(seed.values)
        setModeOverride(null)
        setSelectError('')
      }
    }, [ciApplication, reset])

    // Read-only viewers (IDIR reviewers, submitted applications) always get
    // the summary card; there is nothing for them to select or edit.
    const defaultMode =
      readOnly || ciApplication?.fuelProductionFacilityId
        ? 'summary'
        : isLoadingFacilities || facilities.length > 0
          ? 'select'
          : 'form'
    const facilityMode = readOnly ? 'summary' : (modeOverride ?? defaultMode)

    const summaryValues = watch()
    const hasFacilityDetails = FACILITY_FIELDS.some(
      (name) =>
        summaryValues[name] !== '' &&
        summaryValues[name] !== null &&
        summaryValues[name] !== undefined
    )
    const facilityDocuments = selectedFacility?.documents || []
    const facilityLocation = [
      summaryValues.facilityCity,
      summaryValues.facilityProvinceState,
      summaryValues.facilityCountry
    ]
      .filter(Boolean)
      .join(', ')

    // Uploaded process flow diagram(s) for the selected facility; shown above
    // the Upload button in the form and above "Add new" in the summary.
    const renderFacilityDocuments = ({ allowReplace }) =>
      facilityDocuments.length > 0 ? (
        <Box sx={{ mb: 2 }} data-test="ci-step1-facility-documents">
          {facilityDocuments.map((document) => (
            <Stack
              key={document.documentId}
              direction="row"
              alignItems="center"
              spacing={0.5}
            >
              <BCTypography
                variant="body2"
                sx={{
                  color: colors.primary.main,
                  textDecoration: 'underline'
                }}
              >
                {getDocumentDisplayName(document)}
              </BCTypography>
              <DocumentPreviewButton
                parentType="fuel_production_facility"
                parentID={selectedFacilityId}
                document={document}
              />
              {allowReplace && !readOnly && (
                <IconButton
                  size="small"
                  color="primary"
                  aria-label={t('carbonIntensity:step1.replaceProcessFlow')}
                  onClick={() => setDocumentDialogOpen(true)}
                  data-test="ci-step1-process-flow-replace"
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          ))}
        </Box>
      ) : null

    // Validation errors on hidden fields: prompt for a selection in select
    // mode, otherwise open the form so the errors are visible.
    const onInvalid = () => {
      if (facilityMode === 'select' && !selectedFacilityId) {
        setSelectError(t('carbonIntensity:step1.validation.facilityRequired'))
        return
      }
      setModeOverride('form')
    }

    useImperativeHandle(ref, () => ({
      submit: () =>
        new Promise((resolve, reject) => {
          handleSubmit(
            (values) => resolve(toApiPayload(values)),
            (errors) => {
              onInvalid()
              reject(errors)
            }
          )()
        }),
      isDirty: formState.isDirty
    }))

    // The parent resolves false when the save failed; anything else (including
    // an undefined return) returns the section to its default view.
    const onSubmit = async (values) => {
      const saved = await onSave?.(toApiPayload(values))
      if (saved !== false) {
        setModeOverride(null)
        setSelectError('')
      }
    }

    const applyCitySuggestion = (suggestion) => {
      const [city = '', province = '', country = ''] =
        splitLocationParts(suggestion)
      setValue('facilityCity', city, {
        shouldDirty: true,
        shouldValidate: true,
        shouldTouch: true
      })
      setValue('facilityProvinceState', province, {
        shouldDirty: true,
        shouldValidate: true,
        shouldTouch: true
      })
      setValue('facilityCountry', country, {
        shouldDirty: true,
        shouldValidate: true,
        shouldTouch: true
      })
    }

    const applyProvinceSuggestion = (suggestion) => {
      const [province = '', country = ''] = splitLocationParts(suggestion)
      setValue('facilityProvinceState', province, {
        shouldDirty: true,
        shouldValidate: true,
        shouldTouch: true
      })
      setValue('facilityCountry', country, {
        shouldDirty: true,
        shouldValidate: true,
        shouldTouch: true
      })
    }

    const requiredSuffix = ` ${t('carbonIntensity:labels.required')}`

    return (
      <Box
        component="form"
        noValidate
        autoComplete="off"
        onSubmit={handleSubmit(onSubmit, onInvalid)}
      >
        {/* Autofill honeypots */}
        <Box
          ref={autofillTrapRef}
          aria-hidden="true"
          sx={{
            position: 'absolute',
            left: '-10000px',
            top: 'auto',
            width: 1,
            height: 1,
            overflow: 'hidden'
          }}
        >
          <input
            tabIndex={-1}
            name="address-line1"
            autoComplete="address-line1"
          />
          <input tabIndex={-1} name="city" autoComplete="address-level2" />
          <input tabIndex={-1} name="state" autoComplete="address-level1" />
          <input tabIndex={-1} name="country" autoComplete="country-name" />
        </Box>

        {organization && (
          <Box mb={3}>
            <BCTypography variant="body2" sx={{ fontWeight: 700 }}>
              {organization.name}
            </BCTypography>
            {organization.addressLine && (
              <BCTypography variant="body2">
                {organization.addressLine}
              </BCTypography>
            )}
            {organization.phone && (
              <BCTypography variant="body2">{organization.phone}</BCTypography>
            )}
            {organization.email && (
              <BCTypography variant="body2">{organization.email}</BCTypography>
            )}
            {showOrgInfoConfirmation && organization.addressLine && (
              <BCTypography
                variant="body2"
                sx={{ mt: 1 }}
                data-test="ci-step1-org-info-confirmation"
              >
                {t('carbonIntensity:step1.orgInfoConfirmationPrefix')}{' '}
                <a
                  href={`mailto:${t('carbonIntensity:step1.orgInfoConfirmationEmail')}?subject=${encodeURIComponent(t('carbonIntensity:step1.orgInfoConfirmationEmailSubject'))}`}
                >
                  {t('carbonIntensity:step1.orgInfoConfirmationEmail')}
                </a>
                .
              </BCTypography>
            )}
          </Box>
        )}

        <BCTypography variant="h6" sx={{ pb: 2, color: colors.primary.main }}>
          {t('carbonIntensity:step1.facilitySectionLabel')}
        </BCTypography>

        {facilityMode === 'summary' && !hasFacilityDetails ? (
          <BCTypography
            variant="body2"
            sx={{ mb: 3 }}
            data-test="ci-step1-facility-summary"
          >
            {t('carbonIntensity:step1.noFacilityOnFile')}
          </BCTypography>
        ) : facilityMode === 'summary' ? (
          <>
            <Box sx={{ mb: 3 }} data-test="ci-step1-facility-summary">
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <BCTypography variant="body2" sx={{ fontWeight: 700 }}>
                  {summaryValues.facilityName ||
                    t('carbonIntensity:step1.unnamedFacility')}
                </BCTypography>
                {!readOnly && (
                  <IconButton
                    size="small"
                    color="primary"
                    aria-label={t('carbonIntensity:step1.editFacility')}
                    onClick={() => setModeOverride('form')}
                    data-test="ci-step1-edit-facility"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>
              {facilityLocation && (
                <BCTypography variant="body2">{facilityLocation}</BCTypography>
              )}
              {summaryValues.facilityNameplateCapacity !== '' &&
                summaryValues.facilityNameplateCapacity != null && (
                  <BCTypography variant="body2">
                    {Number(
                      summaryValues.facilityNameplateCapacity
                    ).toLocaleString('en-CA')}
                    {summaryValues.facilityNameplateCapacityUnit
                      ? ` ${summaryValues.facilityNameplateCapacityUnit}`
                      : ''}
                  </BCTypography>
                )}
              {summaryValues.facilityContactName && (
                <BCTypography variant="body2">
                  {summaryValues.facilityContactName}
                </BCTypography>
              )}
              {summaryValues.facilityContactEmail && (
                <BCTypography variant="body2">
                  {summaryValues.facilityContactEmail}
                </BCTypography>
              )}
            </Box>
            {renderFacilityDocuments({ allowReplace: true })}
            {!readOnly && (
              <Box sx={{ mb: 3 }}>
                <BCButton
                  type="button"
                  variant="outlined"
                  color="primary"
                  onClick={handleAddNewFacility}
                  data-test="ci-step1-add-facility"
                >
                  {t('carbonIntensity:step1.addFacility')}
                </BCButton>
              </Box>
            )}
          </>
        ) : facilityMode === 'select' ? (
          <>
            <Box sx={{ mb: 2, maxWidth: { xs: '100%', md: 320 } }}>
              <InputLabel htmlFor="fuelProductionFacilityId" sx={{ pb: 1 }}>
                {t('carbonIntensity:step1.selectFacility')}
              </InputLabel>
              <TextField
                id="fuelProductionFacilityId"
                select
                fullWidth
                value={selectedFacilityId || ''}
                disabled={isLoadingFacilities}
                error={!!selectError}
                helperText={
                  selectError ||
                  (isFacilityListError
                    ? t('carbonIntensity:step1.facilityListFailed')
                    : '')
                }
                onChange={(event) => {
                  const facility = facilities.find(
                    (item) =>
                      item.fuelProductionFacilityId ===
                      Number(event.target.value)
                  )
                  if (facility) handleSelectFacility(facility)
                }}
                SelectProps={{
                  displayEmpty: true,
                  inputProps: { 'data-test': 'fuelProductionFacilityId' }
                }}
                sx={{
                  '& .MuiSelect-select.MuiOutlinedInput-input': {
                    padding: '12px !important',
                    minHeight: '1.4375em'
                  }
                }}
              >
                <MenuItem value="">
                  <em>{t('carbonIntensity:labels.selectPlaceholder')}</em>
                </MenuItem>
                {facilities.map((facility) => (
                  <MenuItem
                    key={facility.fuelProductionFacilityId}
                    value={facility.fuelProductionFacilityId}
                  >
                    {facility.name ||
                      t('carbonIntensity:step1.unnamedFacility')}
                    {facility.city ? ` — ${facility.city}` : ''}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box sx={{ mb: 3 }}>
              <BCButton
                type="button"
                variant="outlined"
                color="primary"
                onClick={handleAddNewFacility}
                data-test="ci-step1-add-facility"
              >
                {t('carbonIntensity:step1.addFacility')}
              </BCButton>
            </Box>
          </>
        ) : (
          <>
            <Grid2 container spacing={2}>
              <Grid2 size={{ xs: 12, md: 4 }}>
                <Controller
                  name="facilityName"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Box mb={2}>
                      <InputLabel htmlFor="facilityName" sx={{ pb: 1 }}>
                        {t('carbonIntensity:step1.facilityName')}
                        {requiredSuffix}
                      </InputLabel>
                      <TextField
                        {...field}
                        id="facilityName"
                        data-test="facilityName"
                        value={field.value ?? ''}
                        disabled={readOnly}
                        required
                        variant="outlined"
                        fullWidth
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    </Box>
                  )}
                />
              </Grid2>
            </Grid2>

            <Grid2 container spacing={2}>
              <Grid2 size={{ xs: 12, md: 4 }}>
                <Controller
                  name="facilityCity"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Box mb={2}>
                      <InputLabel htmlFor="facilityCity" sx={{ pb: 1 }}>
                        {t('carbonIntensity:step1.city')}
                        {requiredSuffix}:
                      </InputLabel>
                      <FacilityLocationAutocomplete
                        id="facilityCity"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        inputRef={field.ref}
                        onSelectSuggestion={applyCitySuggestion}
                        searchType="city"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        disabled={readOnly}
                      />
                    </Box>
                  )}
                />
              </Grid2>

              <Grid2 size={{ xs: 12, md: 4 }}>
                <Controller
                  name="facilityProvinceState"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Box mb={2}>
                      <InputLabel
                        htmlFor="facilityProvinceState"
                        sx={{ pb: 1 }}
                      >
                        {t('carbonIntensity:step1.provinceState')}
                        {requiredSuffix}:
                      </InputLabel>
                      <FacilityLocationAutocomplete
                        id="facilityProvinceState"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        inputRef={field.ref}
                        onSelectSuggestion={applyProvinceSuggestion}
                        searchType="province"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        disabled={readOnly}
                      />
                    </Box>
                  )}
                />
              </Grid2>

              <Grid2 size={{ xs: 12, md: 4 }}>
                <Controller
                  name="facilityCountry"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Box mb={2}>
                      <InputLabel htmlFor="facilityCountry" sx={{ pb: 1 }}>
                        {t('carbonIntensity:step1.country')}
                        {requiredSuffix}:
                      </InputLabel>
                      <FacilityLocationAutocomplete
                        id="facilityCountry"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        inputRef={field.ref}
                        onSelectSuggestion={(suggestion) =>
                          field.onChange(
                            splitLocationParts(suggestion)[0] ?? ''
                          )
                        }
                        searchType="country"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        disabled={readOnly}
                      />
                    </Box>
                  )}
                />
              </Grid2>
            </Grid2>

            <Grid2 container spacing={2}>
              <Grid2 size={{ xs: 12, md: 4 }}>
                <Controller
                  name="facilityNameplateCapacity"
                  control={control}
                  render={({ field, fieldState }) => {
                    const displayValue =
                      field.value === '' ||
                      field.value === null ||
                      field.value === undefined
                        ? ''
                        : Number(field.value).toLocaleString('en-CA')
                    return (
                      <Box mb={2}>
                        <InputLabel
                          htmlFor="facilityNameplateCapacity"
                          sx={{ pb: 1 }}
                        >
                          {t('carbonIntensity:step1.facilityNameplate')}
                          {requiredSuffix}:
                        </InputLabel>
                        <TextField
                          id="facilityNameplateCapacity"
                          data-test="facilityNameplateCapacity"
                          type="text"
                          disabled={readOnly}
                          inputMode="numeric"
                          name={field.name}
                          inputRef={field.ref}
                          onBlur={field.onBlur}
                          value={displayValue}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/[^\d]/g, '')
                            field.onChange(digits === '' ? '' : Number(digits))
                          }}
                          required
                          variant="outlined"
                          fullWidth
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                        />
                      </Box>
                    )
                  }}
                />
              </Grid2>

              <Grid2 size={{ xs: 12, md: 2 }}>
                <Controller
                  name="facilityNameplateCapacityUnit"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Box mb={2}>
                      <InputLabel
                        htmlFor="facilityNameplateCapacityUnit"
                        sx={{ pb: 1 }}
                      >
                        {t('carbonIntensity:step1.unitOfMeasure')}
                        {requiredSuffix}:
                      </InputLabel>
                      <TextField
                        {...field}
                        select
                        disabled={readOnly}
                        id="facilityNameplateCapacityUnit"
                        data-test="facilityNameplateCapacityUnit"
                        value={field.value ?? ''}
                        required
                        variant="outlined"
                        fullWidth
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        SelectProps={{ displayEmpty: true }}
                        sx={{
                          '& .MuiSelect-select.MuiOutlinedInput-input': {
                            padding: '12px !important',
                            minHeight: '1.4375em',
                            boxSizing: 'content-box'
                          }
                        }}
                      >
                        <MenuItem value="">
                          <em>
                            {t('carbonIntensity:labels.selectPlaceholder')}
                          </em>
                        </MenuItem>
                        {unitsOfMeasure.map((u) => (
                          <MenuItem key={u} value={u}>
                            {u}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Box>
                  )}
                />
              </Grid2>
            </Grid2>

            <Grid2 container spacing={2}>
              <Grid2 size={{ xs: 12, md: 4 }}>
                <Controller
                  name="facilityContactName"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Box mb={2}>
                      <InputLabel htmlFor="facilityContactName" sx={{ pb: 1 }}>
                        {t('carbonIntensity:step1.contactName')}
                        {requiredSuffix}
                      </InputLabel>
                      <TextField
                        {...field}
                        id="facilityContactName"
                        data-test="facilityContactName"
                        value={field.value ?? ''}
                        disabled={readOnly}
                        required
                        variant="outlined"
                        fullWidth
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    </Box>
                  )}
                />
              </Grid2>

              <Grid2 size={{ xs: 12, md: 4 }}>
                <Controller
                  name="facilityContactEmail"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Box mb={2}>
                      <InputLabel htmlFor="facilityContactEmail" sx={{ pb: 1 }}>
                        {t('carbonIntensity:step1.contactEmail')}
                        {requiredSuffix}
                      </InputLabel>
                      <TextField
                        {...field}
                        id="facilityContactEmail"
                        data-test="facilityContactEmail"
                        type="email"
                        value={field.value ?? ''}
                        disabled={readOnly}
                        required
                        variant="outlined"
                        fullWidth
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    </Box>
                  )}
                />
              </Grid2>
            </Grid2>

            {renderFacilityDocuments({ allowReplace: false })}
            {/* Documents attach to a saved facility, so uploads wait until an
            existing facility is linked (new ones link on save). */}
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 3 }}
            >
              <BCButton
                type="button"
                variant="outlined"
                color="primary"
                startIcon={
                  <UploadFileIcon
                    sx={{
                      width: '1rem',
                      height: '1rem'
                    }}
                  />
                }
                onClick={() => setDocumentDialogOpen(true)}
                disabled={readOnly || !selectedFacilityId}
                data-test="ci-step1-process-flow-upload"
              >
                {t('carbonIntensity:step1.processFlowDiagram')}
              </BCButton>
            </Stack>
            {!selectedFacilityId && !readOnly && (
              <BCTypography
                variant="caption"
                color="text.secondary"
                component="p"
                sx={{ mt: -2, mb: 3 }}
              >
                {t('carbonIntensity:step1.processFlowSaveFirst')}
              </BCTypography>
            )}
          </>
        )}

        <Grid2 container spacing={2}>
          <Grid2 size={{ xs: 12, md: 8 }}>
            <Controller
              name="proposedFuelCodeEffectiveDate"
              control={control}
              render={({ field, fieldState }) => (
                <Box mb={2}>
                  {/* Static notice, not a live region; the date input
                      references it so screen readers read it on focus. */}
                  {showEffectiveDateNotice && (
                    <BCAlertRoot
                      ownerState={{ color: 'info' }}
                      id={EFFECTIVE_DATE_NOTICE_ID}
                      role="note"
                      data-test={EFFECTIVE_DATE_NOTICE_ID}
                      sx={{
                        justifyContent: 'flex-start',
                        alignItems: 'flex-start',
                        gap: 1,
                        mb: 2
                      }}
                    >
                      <InfoIcon
                        aria-hidden="true"
                        sx={{ flexShrink: 0, mt: '3px' }}
                      />
                      <BCTypography variant="body2" component="p">
                        {t(
                          'carbonIntensity:step1.proposedFuelCodeEffectiveNotice'
                        )}
                      </BCTypography>
                    </BCAlertRoot>
                  )}
                  <InputLabel
                    htmlFor="proposedFuelCodeEffectiveDate"
                    sx={{ pb: 1 }}
                  >
                    {t('carbonIntensity:step1.proposedFuelCodeEffective')}{' '}
                    <BCTypography
                      variant="caption"
                      component="span"
                      color="text.secondary"
                    >
                      {t('carbonIntensity:step1.proposedFuelCodeEffectiveHelp')}
                    </BCTypography>
                  </InputLabel>
                  <DatePicker
                    value={stringToDate(field.value)}
                    onChange={(date) => field.onChange(dateToString(date))}
                    onClose={field.onBlur}
                    format={DATE_FORMAT}
                    disabled={readOnly}
                    disablePast
                    slotProps={{
                      textField: {
                        id: 'proposedFuelCodeEffectiveDate',
                        name: field.name,
                        inputRef: field.ref,
                        onBlur: field.onBlur,
                        variant: 'outlined',
                        error: !!fieldState.error,
                        helperText: fieldState.error?.message,
                        InputLabelProps: { shrink: true },
                        inputProps: {
                          'data-test': 'proposedFuelCodeEffectiveDate',
                          placeholder: 'yyyy-mm-dd',
                          // inputProps replaces the helper-text reference
                          // MUI adds, so keep it alongside the notice
                          'aria-describedby':
                            [
                              showEffectiveDateNotice &&
                                EFFECTIVE_DATE_NOTICE_ID,
                              fieldState.error &&
                                'proposedFuelCodeEffectiveDate-helper-text'
                            ]
                              .filter(Boolean)
                              .join(' ') || undefined
                        },
                        sx: { width: { xs: '100%', sm: 240 } }
                      }
                    }}
                  />
                </Box>
              )}
            />
          </Grid2>
        </Grid2>

        {/* Delete sits far right, away from the primary action (#4770). */}
        <Stack
          direction="row"
          spacing={2}
          sx={{ mt: 2 }}
          alignItems="center"
          justifyContent="space-between"
        >
          <BCButton
            type="submit"
            variant="contained"
            color="primary"
            data-test="ci-step1-save-btn"
            disabled={readOnly || isSaving}
          >
            {t('carbonIntensity:step1.saveAndProceed')}
          </BCButton>
          {ciApplication?.ciApplicationId && onDelete && (
            <BCButton
              type="button"
              variant="outlined"
              color="error"
              data-test="ci-step1-delete-btn"
              onClick={onDelete}
              disabled={readOnly || isSaving}
            >
              {t('carbonIntensity:step1.deleteDraft')}
            </BCButton>
          )}
        </Stack>

        <DocumentUploadDialog
          open={documentDialogOpen}
          close={() => setDocumentDialogOpen(false)}
          parentType="fuel_production_facility"
          parentID={selectedFacilityId}
          maxFiles={1}
        />
      </Box>
    )
  }
)

ApplicationInformationStep.displayName = 'ApplicationInformationStep'
