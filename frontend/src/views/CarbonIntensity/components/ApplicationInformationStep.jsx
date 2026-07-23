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
import {
  Autocomplete,
  Box,
  InputLabel,
  MenuItem,
  Stack,
  TextField
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers'
import { format as formatDate, isValid as isValidDate, parseISO } from 'date-fns'
import { debounce } from 'lodash'
import * as Yup from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'
import Grid2 from '@mui/material/Grid2'

import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { useCIFacilityLocationSearch } from '@/hooks/useCIApplication'
import colors from '@/themes/base/colors'

const DATE_FORMAT = 'yyyy-MM-dd'

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
  const [open, setOpen] = useState(false)
  // Block Chrome address autofill until focus
  const [autofillLocked, setAutofillLocked] = useState(true)
  const [debouncedSearch, setDebouncedSearch] = useState(value || '')
  const autofillToken = `lcfs-no-autofill-${id}`

  const debouncedSetSearch = useCallback(
    debounce((v) => setDebouncedSearch(v), 500),
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
  const hasMatches = options.length > 0

  return (
    <Autocomplete
      freeSolo
      options={options}
      filterOptions={(x) => x}
      open={open && hasMatches}
      onOpen={() => {
        if (hasMatches) setOpen(true)
      }}
      onClose={() => setOpen(false)}
      openOnFocus
      forcePopupIcon={false}
      disableClearable
      disabled={disabled}
      inputValue={value ?? ''}
      value={null}
      sx={LOCATION_AUTOCOMPLETE_SX}
      ListboxProps={{ style: { maxHeight: 320 } }}
      noOptionsText={null}
      onInputChange={(_event, newInputValue, reason) => {
        if (reason === 'input' || reason === 'clear') {
          onChange(newInputValue)
          debouncedSetSearch(newInputValue)
          if (reason === 'clear') setOpen(false)
        }
      }}
      onChange={(_event, newValue, reason) => {
        if (reason === 'selectOption' && typeof newValue === 'string') {
          onSelectSuggestion?.(newValue)
          setOpen(false)
          return
        }
        if (reason === 'clear') {
          onChange('')
          return
        }
        if (typeof newValue === 'string') {
          onChange(newValue)
        }
      }}
      onBlur={(event) => {
        setOpen(false)
        onBlur?.(event)
      }}
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
            setAutofillLocked(false)
            // Defeat Chrome autofill on focus
            event.target.setAttribute('autocomplete', autofillToken)
            if (hasMatches) setOpen(true)
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
            'data-form-type': 'other',
            readOnly: autofillLocked && !disabled
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
    proposedFuelCodeEffectiveDate: Yup.string().nullable()
  })

const toFormValues = (data) => ({
  facilityCity: data?.facilityCity ?? '',
  facilityProvinceState: data?.facilityProvinceState ?? '',
  facilityCountry: data?.facilityCountry ?? '',
  facilityNameplateCapacity: data?.facilityNameplateCapacity ?? '',
  facilityNameplateCapacityUnit: data?.facilityNameplateCapacityUnit ?? '',
  proposedFuelCodeEffectiveDate: data?.proposedFuelCodeEffectiveDate ?? ''
})

const toApiPayload = (values) => ({
  facilityCity: values.facilityCity?.trim(),
  facilityProvinceState: values.facilityProvinceState?.trim(),
  facilityCountry: values.facilityCountry?.trim(),
  facilityNameplateCapacity: Number(values.facilityNameplateCapacity),
  facilityNameplateCapacityUnit: values.facilityNameplateCapacityUnit || null,
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
      readOnly = false
    },
    ref
  ) => {
    const { t } = useTranslation(['common', 'carbonIntensity'])
    const autofillTrapRef = useRef(null)

    const validationSchema = buildValidationSchema(t)
    const form = useForm({
      resolver: yupResolver(validationSchema),
      mode: 'onTouched',
      defaultValues: toFormValues(ciApplication)
    })

    const { control, handleSubmit, reset, setValue, formState } = form

    useEffect(() => {
      reset(toFormValues(ciApplication))
    }, [ciApplication, reset])

    useImperativeHandle(ref, () => ({
      submit: () =>
        new Promise((resolve, reject) => {
          handleSubmit(
            (values) => resolve(toApiPayload(values)),
            (errors) => reject(errors)
          )()
        }),
      isDirty: formState.isDirty
    }))

    const onSubmit = (values) => onSave?.(toApiPayload(values))

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
        onSubmit={handleSubmit(onSubmit)}
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
          <input tabIndex={-1} name="address-line1" autoComplete="address-line1" />
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
          </Box>
        )}

        <BCTypography
          variant="h6"
          sx={{ pb: 2, color: colors.primary.main }}
        >
          {t('carbonIntensity:step1.facilityLocationLabel')}
        </BCTypography>

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
                  <InputLabel htmlFor="facilityProvinceState" sx={{ pb: 1 }}>
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
                      field.onChange(splitLocationParts(suggestion)[0] ?? '')
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
                      disabled={readOnly}
                    />
                  </Box>
                )
              }}
            />
          </Grid2>

          <Grid2 size={{ xs: 12, md: 4 }}>
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
                    id="facilityNameplateCapacityUnit"
                    data-test="facilityNameplateCapacityUnit"
                    value={field.value ?? ''}
                    required
                    variant="outlined"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    disabled={readOnly}
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
                      <em>{t('carbonIntensity:labels.selectPlaceholder')}</em>
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
          <Grid2 size={{ xs: 12, md: 8 }}>
            <Controller
              name="proposedFuelCodeEffectiveDate"
              control={control}
              render={({ field, fieldState }) => (
                <Box mb={2}>
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
                      {t(
                        'carbonIntensity:step1.proposedFuelCodeEffectiveHelp'
                      )}
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
                          placeholder: 'yyyy-mm-dd'
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

        <Stack
          direction="row"
          spacing={2}
          sx={{ mt: 2 }}
          alignItems="center"
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
      </Box>
    )
  }
)

ApplicationInformationStep.displayName = 'ApplicationInformationStep'
