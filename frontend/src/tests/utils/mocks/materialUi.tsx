/**
 * Shared Material-UI component mocks for BC Form testing
 */

import { vi } from 'vite-plus/test'
import type { CheckboxProps as MuiCheckboxProps } from '@mui/material/Checkbox'
import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  OptionHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  HTMLAttributes
} from 'react'

type DivProps = HTMLAttributes<HTMLDivElement>

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  error?: boolean
  helperText?: ReactNode
}

interface FormControlLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  control?: ReactNode
  label?: ReactNode
}

interface RadioGroupProps extends DivProps {
  value?: string | number
}

interface CheckboxMockProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'checked' | 'onChange' | 'size'
> {
  checked?: MuiCheckboxProps['checked']
  onChange?: MuiCheckboxProps['onChange']
  size?: MuiCheckboxProps['size']
}

/**
 * Material-UI component mocks used by BC Form components
 */
const createMaterialUiMocks = () => ({
  TextField: ({
    id,
    label,
    error,
    helperText,
    onChange,
    value,
    disabled,
    ...props
  }: TextFieldProps) => (
    <div data-test="text-field">
      {label && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        data-test={`input-${id}`}
        onChange={onChange}
        value={value || ''}
        disabled={disabled}
        aria-invalid={error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {helperText && (
        <div data-test={`helper-text-${id}`} id={`${id}-error`}>
          {helperText}
        </div>
      )}
    </div>
  ),

  FormControl: ({ children, ...props }: DivProps) => (
    <div data-test="form-control" {...props}>
      {children}
    </div>
  ),

  InputLabel: ({
    htmlFor,
    children,
    ...props
  }: LabelHTMLAttributes<HTMLLabelElement>) => (
    <label htmlFor={htmlFor} data-test={`label-${htmlFor}`} {...props}>
      {children}
    </label>
  ),

  FormControlLabel: ({ control, label, ...props }: FormControlLabelProps) => (
    <label data-test="form-control-label" {...props}>
      {control}
      <span data-test="form-control-label-text">{label}</span>
    </label>
  ),

  Select: ({
    onChange,
    value,
    children,
    ...props
  }: SelectHTMLAttributes<HTMLSelectElement>) => (
    <select
      data-test="select"
      onChange={(e) => onChange && onChange(e)}
      value={value || ''}
      {...props}
    >
      {children}
    </select>
  ),

  MenuItem: ({
    value,
    children,
    ...props
  }: OptionHTMLAttributes<HTMLOptionElement>) => (
    <option data-test="menu-item" value={value} {...props}>
      {children}
    </option>
  ),

  Checkbox: ({
    checked,
    onChange,
    size,
    disabled,
    id,
    ...props
  }: CheckboxMockProps) => (
    <input
      type="checkbox"
      id={id}
      data-test="checkbox"
      checked={checked || false}
      onChange={(event) => onChange?.(event, event.currentTarget.checked)}
      disabled={disabled}
      data-size={size}
      {...props}
    />
  ),

  Radio: ({
    checked,
    onChange,
    value,
    ...props
  }: InputHTMLAttributes<HTMLInputElement>) => (
    <input
      type="radio"
      data-test="radio"
      checked={checked || false}
      onChange={onChange}
      value={value}
      {...props}
    />
  ),

  RadioGroup: ({ value, children, ...props }: RadioGroupProps) => (
    <div
      data-test="radio-group"
      data-value={value}
      role="radiogroup"
      {...props}
    >
      {children}
    </div>
  ),

  Box: ({ children, ...props }: DivProps) => (
    <div data-test="box" {...props}>
      {children}
    </div>
  )
})

/**
 * Creates and applies Material-UI mocks using vi.mock
 */
export const mockMaterialUi = () => {
  const mocks = createMaterialUiMocks()
  vi.mock('@mui/material', () => mocks)
  return mocks
}
