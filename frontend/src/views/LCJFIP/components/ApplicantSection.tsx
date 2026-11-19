import Grid2 from '@mui/material/Grid2'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormHelperText from '@mui/material/FormHelperText'
import { Controller, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import type { LCJFIPOption } from '@/hooks/useLCJFIP'
import type { LCJFIPFormValues } from '../lcjfipForm'
import { FieldLabel } from './fields'

export const OPERATOR_LIST_URL =
  'https://wwwapps.tc.gc.ca/saf-sec-sur/2/CAS-SAC/olsrles.aspx?GoCTemplateCulture=en-CA'

export type ApplicantInfo = {
  organizationName?: string | null
  contactName?: string | null
  contactTitle?: string | null
  addressLine?: string | null
  phone?: string | null
  email?: string | null
}

const SelectField = ({
  name,
  label,
  options,
  readOnly
}: {
  name: 'carTypeId' | 'certificateTypeId'
  label: string
  options: LCJFIPOption[]
  readOnly: boolean
}) => {
  const { t } = useTranslation(['lcjfip'])
  const { control } = useFormContext<LCJFIPFormValues>()
  const labelId = `${name}-label`
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <>
          <FieldLabel id={labelId}>{label}</FieldLabel>
          {/* No FormControl wrapper: the theme's form-control select padding
              would shrink the select below the height of the inputs. */}
          <Select
            labelId={labelId}
            fullWidth
            size="small"
            error={!!fieldState.error}
            value={field.value}
            onChange={(event) => field.onChange(event.target.value)}
            onBlur={field.onBlur}
            inputRef={field.ref}
            name={field.name}
            displayEmpty
            sx={{
              '& .MuiSelect-select.MuiOutlinedInput-input': {
                padding: '8.5px 14px !important',
                minHeight: '1.4375em'
              }
            }}
            disabled={readOnly}
            renderValue={(value) =>
              options.find((option) => option.id === value)?.name ??
              t('lcjfip:applicant.select')
            }
            data-test={`lcjfip-${name}`}
          >
            <MenuItem value="">
              <em>{t('lcjfip:applicant.select')}</em>
            </MenuItem>
            {options.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.name}
              </MenuItem>
            ))}
          </Select>
          {fieldState.error && (
            <FormHelperText error>{fieldState.error.message}</FormHelperText>
          )}
        </>
      )}
    />
  )
}

export const ApplicantSection = ({
  applicant,
  carTypes,
  certificateTypes,
  readOnly
}: {
  applicant: ApplicantInfo
  carTypes: LCJFIPOption[]
  certificateTypes: LCJFIPOption[]
  readOnly: boolean
}) => {
  const { t } = useTranslation(['lcjfip'])
  const programEmail = t('lcjfip:programEmail')
  const contactLine = [applicant.contactName, applicant.contactTitle]
    .filter(Boolean)
    .join(', ')

  return (
    <section aria-labelledby="lcjfip-applicant-heading">
      <BCTypography
        id="lcjfip-applicant-heading"
        variant="h6"
        component="h3"
        color="primary"
        mb={2}
      >
        {t('lcjfip:applicant.heading')}
      </BCTypography>

      <BCBox mb={3} data-test="lcjfip-applicant-info">
        {applicant.organizationName && (
          <BCTypography variant="h6" component="p" color="primary" mb={1}>
            {applicant.organizationName}
          </BCTypography>
        )}
        {contactLine && (
          <BCTypography
            variant="body2"
            sx={{ fontWeight: 700, color: 'link.main' }}
          >
            {contactLine}
          </BCTypography>
        )}
        {applicant.addressLine && (
          <BCTypography variant="body2">{applicant.addressLine}</BCTypography>
        )}
        {applicant.phone && (
          <BCTypography variant="body2">{applicant.phone}</BCTypography>
        )}
        {applicant.email && (
          <BCTypography variant="body2">{applicant.email}</BCTypography>
        )}
        <BCTypography variant="body2" mt={1} data-test="lcjfip-address-change">
          {t('lcjfip:applicant.addressChangePrefix')}{' '}
          <Link
            sx={{ color: 'link.main', textDecoration: 'underline' }}
            href={`mailto:${programEmail}?subject=${encodeURIComponent(
              t('lcjfip:applicant.addressChangeSubject')
            )}`}
          >
            {programEmail}
          </Link>
          .
        </BCTypography>
      </BCBox>

      <Grid2 container spacing={2} alignItems="flex-start">
        <Grid2 size={{ xs: 12, md: 5 }}>
          <SelectField
            name="carTypeId"
            label={t('lcjfip:applicant.carTypes')}
            options={carTypes}
            readOnly={readOnly}
          />
        </Grid2>
        <Grid2 size={{ xs: 12, md: 3 }}>
          <SelectField
            name="certificateTypeId"
            label={t('lcjfip:applicant.certificateType')}
            options={certificateTypes}
            readOnly={readOnly}
          />
        </Grid2>
        <Grid2 size={{ xs: 12, md: 4 }}>
          <BCTypography
            variant="body2"
            component="p"
            sx={{ fontWeight: 600, pb: 1 }}
          >
            {t('lcjfip:applicant.carGuidance')}
          </BCTypography>
          <Link
            href={OPERATOR_LIST_URL}
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            sx={{
              fontWeight: 600,
              color: 'link.main',
              textDecoration: 'underline'
            }}
            data-test="lcjfip-operator-list-link"
          >
            {t('lcjfip:applicant.operatorListLink')}
            <BCBox component="span" sx={visuallyHidden}>
              {' '}
              {t('lcjfip:applicant.opensInNewTab')}
            </BCBox>
          </Link>
        </Grid2>
      </Grid2>
    </section>
  )
}

const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px'
} as const
