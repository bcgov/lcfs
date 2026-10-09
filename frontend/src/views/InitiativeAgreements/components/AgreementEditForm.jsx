import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { yupResolver } from '@hookform/resolvers/yup'
import * as Yup from 'yup'
import { format, isValid, parseISO } from 'date-fns'
import Grid2 from '@mui/material/Grid2'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons'

import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import { BCFormText } from '@/components/BCForm/BCFormText'
import BCTypography from '@/components/BCTypography'
import { useUpdateAgreement } from '@/hooks/useInitiativeAgreements'
import { AGREEMENT_TYPES } from './CreateAgreement'

const DATE_FORMAT = 'yyyy-MM-dd'

const toDate = (value) => {
  const parsed = value ? parseISO(value) : null
  return parsed && isValid(parsed) ? parsed : null
}

const toIsoString = (date) =>
  date && isValid(date) ? format(date, DATE_FORMAT) : ''

const FieldLabel = ({ htmlFor, children, optional }) => (
  <InputLabel htmlFor={htmlFor} component="label" className="form-label">
    <BCTypography variant="label" component="span">
      {children}:&nbsp;
      {optional && (
        <span className="optional" style={{ fontWeight: 'normal' }}>
          (optional)
        </span>
      )}
    </BCTypography>
  </InputLabel>
)

const toFormValues = (agreement) => ({
  iaCode: agreement.iaCode ?? '',
  agreementType: agreement.agreementType ?? AGREEMENT_TYPES[0],
  title: agreement.title ?? '',
  projectLocation: agreement.projectLocation ?? '',
  projectDescription: agreement.projectDescription ?? '',
  agreementStartDate: agreement.agreementStartDate ?? '',
  agreementEndDate: agreement.agreementEndDate ?? ''
})

const blankToNull = (value) => value.trim() || null

export const AgreementEditForm = ({ agreement, onCancel, onSaved }) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [error, setError] = useState('')

  const { mutate: updateAgreement, isPending } = useUpdateAgreement(
    agreement.initiativeAgreementId
  )

  const schema = Yup.object({
    iaCode: Yup.string()
      .trim()
      .max(50, t('initiativeAgreement:edit.tooLong', { max: 50 }))
      .required(t('initiativeAgreement:edit.codeRequired')),
    agreementType: Yup.string().oneOf(AGREEMENT_TYPES).required(),
    title: Yup.string().max(
      500,
      t('initiativeAgreement:edit.tooLong', { max: 500 })
    ),
    projectLocation: Yup.string(),
    projectDescription: Yup.string(),
    agreementStartDate: Yup.string(),
    agreementEndDate: Yup.string().test(
      'not-before-start',
      t('initiativeAgreement:edit.endBeforeStart'),
      function (end) {
        const start = this.parent.agreementStartDate
        return !end || !start || end >= start
      }
    )
  })

  const { control, handleSubmit } = useForm({
    resolver: yupResolver(schema),
    mode: 'onChange',
    defaultValues: toFormValues(agreement)
  })

  const onSubmit = (values) => {
    setError('')
    updateAgreement(
      {
        iaCode: values.iaCode.trim(),
        agreementType: values.agreementType,
        title: blankToNull(values.title),
        projectLocation: blankToNull(values.projectLocation),
        projectDescription: blankToNull(values.projectDescription),
        agreementStartDate: values.agreementStartDate || null,
        agreementEndDate: values.agreementEndDate || null
      },
      {
        onSuccess: () => onSaved(values.iaCode.trim()),
        onError: (err) =>
          setError(
            err?.response?.data?.detail ||
              err?.message ||
              t('initiativeAgreement:edit.failed')
          )
      }
    )
  }

  const dateField = (name, label) => (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <>
          <FieldLabel htmlFor={name} optional>
            {label}
          </FieldLabel>
          <DatePicker
            value={toDate(field.value)}
            onChange={(date) => field.onChange(toIsoString(date))}
            onClose={field.onBlur}
            format={DATE_FORMAT}
            slotProps={{
              textField: {
                id: name,
                name: field.name,
                inputRef: field.ref,
                onBlur: field.onBlur,
                fullWidth: true,
                variant: 'outlined',
                error: !!fieldState.error,
                helperText: fieldState.error?.message,
                inputProps: { 'data-test': name, placeholder: 'yyyy-mm-dd' }
              }
            }}
          />
        </>
      )}
    />
  )

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      data-test="agreement-edit-form"
    >
      {error && (
        <BCAlert data-test="edit-agreement-error" severity="error">
          {error}
        </BCAlert>
      )}

      <Grid2 container spacing={3}>
        <Grid2 size={12}>
          <FieldLabel>
            {t('initiativeAgreement:create.organizationLabel')}
          </FieldLabel>
          <BCTypography variant="body4" data-test="agreement-organization">
            {agreement.organization?.name}
          </BCTypography>
        </Grid2>

        <Grid2 size={{ xs: 12, md: 6 }}>
          <BCFormText
            name="iaCode"
            control={control}
            label={t('initiativeAgreement:create.codeLabel')}
          />
        </Grid2>

        <Grid2 size={{ xs: 12, md: 6 }}>
          <Controller
            name="agreementType"
            control={control}
            render={({ field }) => (
              <>
                <FieldLabel htmlFor="agreementType">
                  {t('initiativeAgreement:create.typeLabel')}
                </FieldLabel>
                <TextField
                  {...field}
                  id="agreementType"
                  select
                  fullWidth
                  sx={{
                    // The theme zeroes the select's vertical padding; match
                    // the text inputs' height.
                    '& .MuiSelect-select.MuiSelect-select': {
                      padding: '12px 10px !important'
                    }
                  }}
                  inputProps={{ 'data-test': 'agreementType' }}
                >
                  {AGREEMENT_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>
              </>
            )}
          />
        </Grid2>

        <Grid2 size={12}>
          <BCFormText
            name="title"
            control={control}
            label={t('initiativeAgreement:create.titleLabel')}
            optional
          />
        </Grid2>

        <Grid2 size={{ xs: 12, md: 6 }}>
          {dateField(
            'agreementStartDate',
            t('initiativeAgreement:create.startLabel')
          )}
        </Grid2>
        <Grid2 size={{ xs: 12, md: 6 }}>
          {dateField(
            'agreementEndDate',
            t('initiativeAgreement:create.endLabel')
          )}
        </Grid2>

        <Grid2 size={12}>
          <BCFormText
            name="projectLocation"
            control={control}
            label={t('initiativeAgreement:create.locationLabel')}
            optional
          />
        </Grid2>

        <Grid2 size={12}>
          <BCFormText
            name="projectDescription"
            control={control}
            label={t('initiativeAgreement:edit.descriptionLabel')}
            optional
            multiline
            rows={4}
          />
        </Grid2>
      </Grid2>

      <Stack direction="row" spacing={2} mt={3}>
        <BCButton
          type="submit"
          variant="contained"
          size="medium"
          color="primary"
          data-test="save-agreement"
          isLoading={isPending}
          startIcon={
            <FontAwesomeIcon icon={faFloppyDisk} className="small-icon" />
          }
        >
          <BCTypography variant="button">{t('common:saveBtn')}</BCTypography>
        </BCButton>
        <BCButton
          type="button"
          variant="outlined"
          color="primary"
          data-test="cancel-agreement-edit"
          disabled={isPending}
          onClick={onCancel}
        >
          <BCTypography variant="subtitle2" textTransform="none">
            {t('common:cancelBtn')}
          </BCTypography>
        </BCButton>
      </Stack>
    </form>
  )
}

export default AgreementEditForm
