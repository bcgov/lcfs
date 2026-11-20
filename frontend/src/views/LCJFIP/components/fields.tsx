import InputLabel from '@mui/material/InputLabel'
import TextField from '@mui/material/TextField'
import type { TextFieldProps } from '@mui/material/TextField'
import { Controller, useFormContext } from 'react-hook-form'
import { NumericFormat } from 'react-number-format'
import type { NumberFormatValues } from 'react-number-format'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import type { LCJFIPFormValues } from '../lcjfipForm'
import { visuallyHidden } from './visuallyHidden'

const Asterisk = () => (
  <BCBox component="span" aria-hidden="true" sx={{ color: 'error.main' }}>
    *
  </BCBox>
)

/** The mock-up's key for the red asterisk on required fields. */
export const RequiredLegend = () => {
  const { t } = useTranslation(['lcjfip'])
  return (
    <BCTypography
      variant="body2"
      sx={{ fontStyle: 'italic', mb: 2 }}
      data-test="lcjfip-required-legend"
    >
      <Asterisk /> {t('lcjfip:requiredLegend')}
    </BCTypography>
  )
}

/**
 * A field label. Required fields show the mock-up's red asterisk; screen
 * readers hear "(required)" instead, since the asterisk is hidden from them.
 * `marked` shows the asterisk alone, for a calculated value that the
 * mock-up marks but nobody types in.
 */
export const FieldLabel = ({
  htmlFor,
  id,
  required = false,
  marked = false,
  strong = false,
  children
}: {
  htmlFor?: string
  id?: string
  required?: boolean
  marked?: boolean
  /** Bold, as the mock-up shows the applicant section's labels */
  strong?: boolean
  children: ReactNode
}) => {
  const { t } = useTranslation(['lcjfip'])
  return (
    <InputLabel
      htmlFor={htmlFor}
      id={id}
      sx={{
        pb: 1,
        color: 'text.primary',
        whiteSpace: 'normal',
        fontSize: '0.875rem',
        fontWeight: strong ? 600 : 400,
        // In a FieldGrid the label sits just above its input, however many
        // lines the other labels in the row take.
        alignSelf: 'end'
      }}
    >
      {(required || marked) && <Asterisk />}
      {children}
      {required && (
        <BCBox component="span" sx={visuallyHidden}>
          {` ${t('lcjfip:required')}`}
        </BCBox>
      )}
    </InputLabel>
  )
}

/**
 * Lays fields out in columns so that every input in a row lines up, even
 * when one label wraps onto two lines. Each FieldCell spans two rows of the
 * grid (label, then input) and shares them through CSS subgrid.
 */
export const FieldGrid = ({
  columns,
  maxWidth,
  children
}: {
  /** grid-template-columns, per breakpoint if needed */
  columns: string | Partial<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', string>>
  maxWidth?: number
  children: ReactNode
}) => (
  <BCBox
    sx={{
      display: 'grid',
      columnGap: 2,
      rowGap: 0,
      gridTemplateColumns: columns,
      alignItems: 'start',
      maxWidth
    }}
  >
    {children}
  </BCBox>
)

/** One field in a FieldGrid: its label, then its input and any messages. */
export const FieldCell = ({
  label,
  children,
  dataTest
}: {
  label: ReactNode
  children: ReactNode
  dataTest?: string
}) => (
  <BCBox
    sx={{
      display: 'grid',
      gridRow: 'span 2',
      gridTemplateRows: 'subgrid',
      rowGap: 0,
      pb: 2,
      minWidth: 0
    }}
    data-test={dataTest}
  >
    {label}
    <BCBox sx={{ minWidth: 0 }}>{children}</BCBox>
  </BCBox>
)

type NumberFieldProps = Omit<TextFieldProps, 'name' | 'value' | 'onChange'> & {
  name: string
  decimalScale: number
  /** Always show every decimal place, e.g. 24.50 */
  fixedDecimalScale?: boolean
  allowNegative?: boolean
  thousandSeparator?: boolean
  prefix?: string
  suffix?: string
  isAllowed?: (values: NumberFormatValues) => boolean
}

/**
 * A numeric input bound to the form. The form value is a number or null;
 * the input shows it with thousands separators, the field's precision and
 * any unit the mock-up shows ($ before a price, L after a volume).
 */
export const NumberField = ({
  name,
  decimalScale,
  fixedDecimalScale = false,
  allowNegative = false,
  thousandSeparator = true,
  prefix,
  suffix,
  isAllowed,
  ...textFieldProps
}: NumberFieldProps) => {
  const { control } = useFormContext<LCJFIPFormValues>()
  return (
    <Controller
      name={name as never}
      control={control}
      render={({ field, fieldState }) => (
        <NumericFormat
          customInput={TextField}
          value={(field.value as number | null) ?? ''}
          onValueChange={(values, sourceInfo) => {
            // Only the user's typing changes the form value, not a reset.
            if (sourceInfo.source === 'event') {
              field.onChange(values.floatValue ?? null)
            }
          }}
          onBlur={field.onBlur}
          inputRef={field.ref}
          name={field.name}
          decimalScale={decimalScale}
          fixedDecimalScale={fixedDecimalScale}
          allowNegative={allowNegative}
          thousandSeparator={thousandSeparator}
          prefix={prefix}
          suffix={suffix}
          isAllowed={isAllowed}
          valueIsNumericString={false}
          size="small"
          fullWidth
          error={!!fieldState.error}
          helperText={fieldState.error?.message}
          {...(textFieldProps as Record<string, unknown>)}
        />
      )}
    />
  )
}
