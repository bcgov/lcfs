import { forwardRef, useEffect, useImperativeHandle } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField
} from '@mui/material'
import * as Yup from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'
import Grid2 from '@mui/material/Grid2'

import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'

const RequiredHint = ({ children }) => (
  <BCTypography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
    ({children})
  </BCTypography>
)

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

    return (
      <Box component="form" noValidate onSubmit={handleSubmit(onSubmit)}>
        {organization && (
          <Box mb={3}>
            <BCTypography variant="h6">{organization.name}</BCTypography>
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

        <BCTypography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          {t('carbonIntensity:step1.facilityLocationLabel')}
        </BCTypography>

        <Grid2 container spacing={2}>
          <Grid2 size={{ xs: 12, md: 4 }}>
            <Controller
              name="facilityCity"
              control={control}
              render={({ field, fieldState }) => (
                <Box>
                  <InputLabel htmlFor="facilityCity">
                    <BCTypography variant="body2" component="span">
                      {t('carbonIntensity:step1.city')}{' '}
                    </BCTypography>
                    <RequiredHint>
                      {t('carbonIntensity:labels.optional').replace(
                        /[()]/g,
                        ''
                      )}
                    </RequiredHint>
                  </InputLabel>
                  <TextField
                    {...field}
                    id="facilityCity"
                    fullWidth
                    size="small"
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
                <Box>
                  <InputLabel htmlFor="facilityProvinceState">
                    <BCTypography variant="body2" component="span">
                      {t('carbonIntensity:step1.provinceState')}{' '}
                    </BCTypography>
                    <RequiredHint>
                      {t('carbonIntensity:labels.optional').replace(
                        /[()]/g,
                        ''
                      )}
                    </RequiredHint>
                  </InputLabel>
                  <TextField
                    {...field}
                    id="facilityProvinceState"
                    fullWidth
                    size="small"
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
                <Box>
                  <InputLabel htmlFor="facilityCountry">
                    <BCTypography variant="body2" component="span">
                      {t('carbonIntensity:step1.country')}{' '}
                    </BCTypography>
                    <RequiredHint>
                      {t('carbonIntensity:labels.required').replace(
                        /[()]/g,
                        ''
                      )}
                    </RequiredHint>
                  </InputLabel>
                  <TextField
                    {...field}
                    id="facilityCountry"
                    required
                    fullWidth
                    size="small"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    disabled={readOnly}
                  />
                </Box>
              )}
            />
          </Grid2>
        </Grid2>

        <Grid2 container spacing={2} sx={{ mt: 2 }}>
          <Grid2 size={{ xs: 12, md: 4 }}>
            <Controller
              name="facilityNameplateCapacity"
              control={control}
              render={({ field, fieldState }) => (
                <Box>
                  <InputLabel htmlFor="facilityNameplateCapacity">
                    <BCTypography
                      variant="body2"
                      component="span"
                      sx={{ fontWeight: 600 }}
                    >
                      {t('carbonIntensity:step1.facilityNameplate')}{' '}
                    </BCTypography>
                    <RequiredHint>
                      {t('carbonIntensity:labels.required').replace(
                        /[()]/g,
                        ''
                      )}
                    </RequiredHint>
                  </InputLabel>
                  <TextField
                    {...field}
                    id="facilityNameplateCapacity"
                    type="number"
                    inputProps={{ min: 1, step: 1 }}
                    required
                    fullWidth
                    size="small"
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
              name="facilityNameplateCapacityUnitId"
              control={control}
              render={({ field, fieldState }) => (
                <Box>
                  <InputLabel htmlFor="facilityNameplateCapacityUnitId">
                    <BCTypography variant="body2" component="span">
                      {t('carbonIntensity:step1.unitOfMeasure')}{' '}
                    </BCTypography>
                    <RequiredHint>
                      {t('carbonIntensity:labels.required').replace(
                        /[()]/g,
                        ''
                      )}
                    </RequiredHint>
                  </InputLabel>
                  <FormControl
                    fullWidth
                    size="small"
                    error={!!fieldState.error}
                    disabled={readOnly}
                  >
                    <Select
                      {...field}
                      id="facilityNameplateCapacityUnitId"
                      value={field.value ?? ''}
                      displayEmpty
                    >
                      <MenuItem value="">
                        <em>{t('carbonIntensity:labels.selectPlaceholder')}</em>
                      </MenuItem>
                      {unitsOfMeasure.map((u) => (
                        <MenuItem key={u.uomId} value={u.uomId}>
                          {u.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {fieldState.error && (
                    <BCTypography variant="caption" color="error">
                      {fieldState.error.message}
                    </BCTypography>
                  )}
                </Box>
              )}
            />
          </Grid2>
        </Grid2>

        <Box sx={{ mt: 3 }}>
          <Controller
            name="proposedFuelCodeEffectiveDate"
            control={control}
            render={({ field, fieldState }) => (
              <Box>
                <InputLabel htmlFor="proposedFuelCodeEffectiveDate">
                  <BCTypography
                    variant="body2"
                    component="span"
                    sx={{ fontWeight: 600 }}
                  >
                    {t('carbonIntensity:step1.proposedFuelCodeEffective')}{' '}
                  </BCTypography>
                  <BCTypography
                    variant="caption"
                    component="span"
                    color="text.secondary"
                  >
                    {t('carbonIntensity:step1.proposedFuelCodeEffectiveHelp')}
                  </BCTypography>
                </InputLabel>
                <TextField
                  {...field}
                  id="proposedFuelCodeEffectiveDate"
                  type="date"
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  disabled={readOnly}
                  sx={{ width: 220 }}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            )}
          />
        </Box>

        <Stack
          direction="row"
          spacing={2}
          sx={{ mt: 4 }}
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
