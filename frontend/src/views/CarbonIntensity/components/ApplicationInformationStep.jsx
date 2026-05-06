import { forwardRef, useEffect, useImperativeHandle } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  Box,
  InputLabel,
  MenuItem,
  Stack,
  TextField
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers'
import { format as formatDate, isValid as isValidDate, parseISO } from 'date-fns'
import * as Yup from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'
import Grid2 from '@mui/material/Grid2'

import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import colors from '@/themes/base/colors'

const DATE_FORMAT = 'yyyy-MM-dd'

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

const buildValidationSchema = (t) =>
  Yup.object({
    facilityCity: Yup.string().nullable(),
    facilityProvinceState: Yup.string().nullable(),
    facilityCountry: Yup.string()
      .trim()
      .required(t('carbonIntensity:step1.validation.countryRequired')),
    facilityNameplateCapacity: Yup.number()
      .typeError(t('carbonIntensity:step1.validation.capacityRequired'))
      .required(t('carbonIntensity:step1.validation.capacityRequired'))
      .positive(t('carbonIntensity:step1.validation.capacityPositive'))
      .integer(t('carbonIntensity:step1.validation.capacityPositive')),
    facilityNameplateCapacityUnitId: Yup.number()
      .typeError(t('carbonIntensity:step1.validation.uomRequired'))
      .required(t('carbonIntensity:step1.validation.uomRequired')),
    proposedFuelCodeEffectiveDate: Yup.string().nullable()
  })

const toFormValues = (data) => ({
  facilityCity: data?.facilityCity ?? '',
  facilityProvinceState: data?.facilityProvinceState ?? '',
  facilityCountry: data?.facilityCountry ?? '',
  facilityNameplateCapacity: data?.facilityNameplateCapacity ?? '',
  facilityNameplateCapacityUnitId:
    data?.facilityNameplateCapacityUnitId ?? '',
  proposedFuelCodeEffectiveDate: data?.proposedFuelCodeEffectiveDate ?? ''
})

const toApiPayload = (values) => ({
  facilityCity: values.facilityCity || null,
  facilityProvinceState: values.facilityProvinceState || null,
  facilityCountry: values.facilityCountry?.trim(),
  facilityNameplateCapacity: Number(values.facilityNameplateCapacity),
  facilityNameplateCapacityUnitId: Number(
    values.facilityNameplateCapacityUnitId
  ),
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

    const validationSchema = buildValidationSchema(t)
    const form = useForm({
      resolver: yupResolver(validationSchema),
      mode: 'onTouched',
      defaultValues: toFormValues(ciApplication)
    })

    const { control, handleSubmit, reset, formState } = form

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

    const optionalSuffix = ` ${t('carbonIntensity:labels.optional')}`
    const requiredSuffix = ` ${t('carbonIntensity:labels.required')}`

    return (
      <Box component="form" noValidate onSubmit={handleSubmit(onSubmit)}>
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
                    {optionalSuffix}:
                  </InputLabel>
                  <TextField
                    {...field}
                    id="facilityCity"
                    data-test="facilityCity"
                    variant="outlined"
                    fullWidth
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
                    {optionalSuffix}:
                  </InputLabel>
                  <TextField
                    {...field}
                    id="facilityProvinceState"
                    data-test="facilityProvinceState"
                    variant="outlined"
                    fullWidth
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
                  <TextField
                    {...field}
                    id="facilityCountry"
                    data-test="facilityCountry"
                    required
                    variant="outlined"
                    fullWidth
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
                  field.value === '' || field.value === null || field.value === undefined
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
                      // Free-form text so we can render thousands separators while
                      // still capturing only digits on input.
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
              name="facilityNameplateCapacityUnitId"
              control={control}
              render={({ field, fieldState }) => (
                <Box mb={2}>
                  <InputLabel
                    htmlFor="facilityNameplateCapacityUnitId"
                    sx={{ pb: 1 }}
                  >
                    {t('carbonIntensity:step1.unitOfMeasure')}
                    {requiredSuffix}:
                  </InputLabel>
                  <TextField
                    {...field}
                    select
                    id="facilityNameplateCapacityUnitId"
                    data-test="facilityNameplateCapacityUnitId"
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
                      <MenuItem key={u.uomId} value={u.uomId}>
                        {u.name}
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
                    {t('carbonIntensity:step1.proposedFuelCodeEffective')}
                    {' '}
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
