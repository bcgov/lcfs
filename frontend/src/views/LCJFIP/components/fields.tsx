import InputLabel from '@mui/material/InputLabel'
import TextField from '@mui/material/TextField'
import type { TextFieldProps } from '@mui/material/TextField'
import { Controller, useFormContext } from 'react-hook-form'
import { NumericFormat } from 'react-number-format'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import type { LCJFIPFormValues } from '../lcjfipForm'

/** A field label; required fields carry the portal's "(required)" suffix. */
export const FieldLabel = ({
  htmlFor,
  id,
  required = false,
  children
}: {
  htmlFor?: string
  id?: string
  required?: boolean
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
        fontSize: '0.95rem'
      }}
    >
      {children}
      {required && ` ${t('lcjfip:required')}`}
    </InputLabel>
  )
}

type NumberFieldProps = Omit<TextFieldProps, 'name' | 'value' | 'onChange'> & {
  name: string
  decimalScale: number
  allowNegative?: boolean
  thousandSeparator?: boolean
}

/**
 * A numeric input bound to the form. The form value is a number or null;
 * the input shows it with thousands separators and the field's precision.
 */
export const NumberField = ({
  name,
  decimalScale,
  allowNegative = false,
  thousandSeparator = true,
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
          allowNegative={allowNegative}
          thousandSeparator={thousandSeparator}
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
