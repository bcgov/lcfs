import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Local override for @/components/BCForm so that BCFormRadio propagates `disabled`
// to its rendered inputs. This lets us assert the new behaviour where IA radio
// inputs are NOT disabled simply because Director is selected.
vi.mock('@/components/BCForm', () => ({
  BCFormCheckbox: ({ name, options = [] }) =>
    React.createElement(
      'div',
      { 'data-test': `${name}-checkbox-group` },
      options.map((opt, i) =>
        React.createElement('input', {
          key: `${name}-${i}`,
          type: 'checkbox',
          'data-test': opt.dataTestId || `${name}${i + 1}`,
          'data-testid': opt.dataTestId || `${name}${i + 1}`
        })
      )
    ),
  BCFormRadio: ({ name, options = [], disabled }) =>
    React.createElement(
      'div',
      { 'data-test': `${name}-radio-group` },
      options.map((opt, i) =>
        React.createElement('input', {
          key: `${name}-${i}`,
          type: 'radio',
          name,
          value: opt.value || opt,
          disabled: !!disabled,
          'data-test': opt.dataTestId || `${name}${i + 1}`,
          'data-testid': opt.dataTestId || `${name}${i + 1}`
        })
      )
    )
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, variant, component }) => (
    <div data-test="bc-typography" data-variant={variant} data-component={component}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCForm/CustomLabel', () => ({
  CustomLabel: ({ header, text }) => (
    <span data-test="custom-label" data-header={header} data-text={text}>
      {header}
    </span>
  )
}))

vi.mock('react-hook-form', () => ({
  Controller: ({ name, control, render: renderFn }) =>
    renderFn({
      field: {
        onChange: vi.fn(),
        value: control?.__mockIdirRole ?? ''
      }
    })
}))

vi.mock('@mui/material', () => ({
  Box: ({ children }) => <div data-test="box">{children}</div>,
  FormControl: ({ children }) => <div data-test="form-control">{children}</div>,
  FormControlLabel: ({ control: ctrl, label, value }) => (
    <div data-test="form-control-label" data-value={value}>
      {ctrl}
      {label}
    </div>
  ),
  Radio: ({ disabled }) => (
    <input data-test="radio" type="radio" disabled={disabled} readOnly />
  ),
  RadioGroup: ({ children, value }) => (
    <div data-test="radio-group" data-value={value}>
      {children}
    </div>
  )
}))

vi.mock('../_schema', () => ({
  adminRoleOptions: vi.fn(() => [
    { label: 'Administrator', header: 'Administrator', text: 'admin desc', value: 'administrator', dataTestId: 'adminRole1' },
    { label: 'System Admin', header: 'System Admin', text: 'system admin desc', value: 'system admin', dataTestId: 'adminRole2' }
  ]),
  iaRoleOptions: vi.fn(() => [
    { label: 'IA Analyst', header: 'IA Analyst', text: 'ia analyst desc', value: 'ia analyst', dataTestId: 'iaRole1' },
    { label: 'IA Manager', header: 'IA Manager', text: 'ia manager desc', value: 'ia manager', dataTestId: 'iaRole2' }
  ])
}))

vi.mock('@/constants/roles', () => ({
  roles: {
    director: 'Director',
    analyst: 'Analyst',
    compliance_manager: 'Compliance Manager',
    ia_analyst: 'IA Analyst',
    ia_manager: 'IA Manager'
  }
}))

import { IDIRSpecificRoleFields } from '../components/IDIRSpecificRoleFields'
import { adminRoleOptions, iaRoleOptions } from '../_schema'

const t = vi.fn((key) => key)

function makeForm(idirRoleValue = '', iaRoleValue = '') {
  return {
    control: { __mockIdirRole: idirRoleValue },
    watch: vi.fn((field) => {
      if (field === 'idirRole') return idirRoleValue
      if (field === 'iaRole') return iaRoleValue
      return ''
    })
  }
}

describe('IDIRSpecificRoleFields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    t.mockImplementation((key) => key)
  })

  it('renders without crashing', () => {
    render(<IDIRSpecificRoleFields form={makeForm()} disabled={false} t={t} />)
    expect(screen.getByTestId('box')).toBeInTheDocument()
  })

  it('renders a "Roles" heading via BCTypography', () => {
    render(<IDIRSpecificRoleFields form={makeForm()} disabled={false} t={t} />)
    const headings = screen.getAllByTestId('bc-typography')
    expect(headings.some((el) => el.textContent === 'admin:Roles')).toBe(true)
  })

  it('renders the admin checkbox group (Administrator + System Admin)', () => {
    render(<IDIRSpecificRoleFields form={makeForm()} disabled={false} t={t} />)
    // Global BCFormCheckbox mock → <div data-test="adminRole-checkbox-group">
    expect(screen.getByTestId('adminRole-checkbox-group')).toBeInTheDocument()
    // Two child inputs (one per option)
    const inputs = screen
      .getByTestId('adminRole-checkbox-group')
      .querySelectorAll('input')
    expect(inputs).toHaveLength(2)
  })

  it('renders the idirRole radio group with Director, Analyst, Compliance Manager', () => {
    render(<IDIRSpecificRoleFields form={makeForm()} disabled={false} t={t} />)
    const labels = screen
      .getAllByTestId('custom-label')
      .map((el) => el.getAttribute('data-header'))
    expect(labels).toContain('Director')
    expect(labels).toContain('Analyst')
    expect(labels).toContain('Compliance Manager')
  })

  it('renders the Initiative Agreements section heading', () => {
    render(<IDIRSpecificRoleFields form={makeForm()} disabled={false} t={t} />)
    expect(t).toHaveBeenCalledWith('admin:userForm.initiativeAgreementsSection')
  })

  it('renders the compliance sub-section heading inside the radio group', () => {
    render(<IDIRSpecificRoleFields form={makeForm()} disabled={false} t={t} />)
    expect(t).toHaveBeenCalledWith('admin:userForm.complianceSection')
  })

  it('renders BCFormRadio for IA roles (iaRole-radio-group)', () => {
    render(<IDIRSpecificRoleFields form={makeForm()} disabled={false} t={t} />)
    // Global BCFormRadio mock → <div data-test="iaRole-radio-group">
    expect(screen.getByTestId('iaRole-radio-group')).toBeInTheDocument()
  })

  it('renders two IA role radio inputs (IA Analyst, IA Manager)', () => {
    render(<IDIRSpecificRoleFields form={makeForm()} disabled={false} t={t} />)
    const iaGroup = screen.getByTestId('iaRole-radio-group')
    expect(iaGroup.querySelectorAll('input[type="radio"]')).toHaveLength(2)
  })

  it('renders Director radio option with correct value', () => {
    render(<IDIRSpecificRoleFields form={makeForm()} disabled={false} t={t} />)
    const directorLabel = screen
      .getAllByTestId('form-control-label')
      .find((el) => el.getAttribute('data-value') === 'director')
    expect(directorLabel).toBeTruthy()
  })

  it('calls adminRoleOptions and iaRoleOptions with the t function', () => {
    render(<IDIRSpecificRoleFields form={makeForm()} disabled={false} t={t} />)
    expect(adminRoleOptions).toHaveBeenCalledWith(t)
    expect(iaRoleOptions).toHaveBeenCalledWith(t)
  })

  it('disables idirRole radios (Director/Analyst/CM) when disabled=true', () => {
    render(<IDIRSpecificRoleFields form={makeForm()} disabled={true} t={t} />)
    const radios = screen.getAllByTestId('radio')
    radios.forEach((r) => expect(r).toBeDisabled())
  })

  it('Director radio is rendered in the radio group', () => {
    render(<IDIRSpecificRoleFields form={makeForm('director')} disabled={false} t={t} />)
    expect(screen.getByTestId('radio-group')).toBeInTheDocument()
  })

  it('IA role radio inputs are NOT disabled when Director is selected and form is enabled', () => {
    render(<IDIRSpecificRoleFields form={makeForm('director')} disabled={false} t={t} />)
    const iaGroup = screen.getByTestId('iaRole-radio-group')
    const iaInputs = iaGroup.querySelectorAll('input[type="radio"]')
    expect(iaInputs).toHaveLength(2)
    iaInputs.forEach((input) => expect(input).not.toBeDisabled())
  })

  it('IA role radio inputs ARE disabled when form disabled=true, regardless of Director', () => {
    render(<IDIRSpecificRoleFields form={makeForm('director')} disabled={true} t={t} />)
    const iaGroup = screen.getByTestId('iaRole-radio-group')
    const iaInputs = iaGroup.querySelectorAll('input[type="radio"]')
    iaInputs.forEach((input) => expect(input).toBeDisabled())
  })

  it('IA role radio inputs are enabled when no idirRole is selected', () => {
    render(<IDIRSpecificRoleFields form={makeForm('')} disabled={false} t={t} />)
    const iaGroup = screen.getByTestId('iaRole-radio-group')
    const iaInputs = iaGroup.querySelectorAll('input[type="radio"]')
    iaInputs.forEach((input) => expect(input).not.toBeDisabled())
  })
})
