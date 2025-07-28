/**
 * Shared Material-UI component mocks for BC Form testing
 */
import React from 'react'
import { vi } from 'vitest'

/**
 * Material-UI component mocks used by BC Form components
 */
const createMaterialUiMocks = () => ({
  TextField: ({ id, label, error, helperText, onChange, value, disabled, ...props }) => (
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
      {helperText && <div data-test={`helper-text-${id}`} id={`${id}-error`}>{helperText}</div>}
    </div>
  ),

  FormControl: ({ children, ...props }) => (
    <div data-test="form-control" {...props}>
      {children}
    </div>
  ),

  InputLabel: ({ htmlFor, children, ...props }) => (
    <label 
      htmlFor={htmlFor} 
      data-test={`label-${htmlFor}`}
      {...props}
    >
      {children}
    </label>
  ),

  FormControlLabel: ({ control, label, ...props }) => (
    <label data-test="form-control-label" {...props}>
      {control}
      <span data-test="form-control-label-text">{label}</span>
    </label>
  ),

  Select: ({ onChange, value, children, ...props }) => (
    <select
      data-test="select"
      onChange={(e) => onChange && onChange(e)}
      value={value || ''}
      {...props}
    >
      {children}
    </select>
  ),

  MenuItem: ({ value, children, ...props }) => (
    <option data-test="menu-item" value={value} {...props}>
      {children}
    </option>
  ),

  Checkbox: ({ checked, onChange, size, disabled, id, ...props }) => (
    <input
      type="checkbox"
      id={id}
      data-test="checkbox"
      checked={checked || false}
      onChange={onChange}
      disabled={disabled}
      data-size={size}
      {...props}
    />
  ),

  Radio: ({ checked, onChange, value, ...props }) => (
    <input
      type="radio"
      data-test="radio"
      checked={checked || false}
      onChange={onChange}
      value={value}
      {...props}
    />
  ),

  RadioGroup: ({ value, children, ...props }) => (
    <div data-test="radio-group" data-value={value} role="radiogroup" {...props}>
      {children}
    </div>
  ),

  Box: ({ children, ...props }) => (
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