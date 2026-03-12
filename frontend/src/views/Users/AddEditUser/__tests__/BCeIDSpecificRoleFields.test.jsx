import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// @/components/BCForm is globally mocked in testSetup.js:
//   BCFormCheckbox → <div data-test="{name}-checkbox-group"> with child <input> per option
// Our mock for CustomLabel and MUI components uses `data-test` (testIdAttribute config).

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
        value: control?.__mockValue ?? []
      }
    })
}))

vi.mock('@mui/material', () => ({
  Box: ({ children }) => <div data-test="box">{children}</div>,
  FormControl: ({ children }) => <div data-test="form-control">{children}</div>,
  FormControlLabel: ({ control: ctrl, label }) => (
    <div data-test="form-control-label">
      {ctrl}
      {label}
    </div>
  ),
  Checkbox: ({ id, checked, disabled }) => (
    <input
      data-test="ia-signer-checkbox"
      id={id}
      type="checkbox"
      defaultChecked={checked}
      disabled={disabled}
      readOnly
    />
  )
}))

vi.mock('../_schema', () => ({
  bceidRoleOptions: vi.fn(() => [
    { label: 'Manage Users', header: 'Manage Users', text: 'desc', value: 'manage users', dataTestId: 'bceidRoles1' },
    { label: 'IA Proponent', header: 'IA Proponent', text: 'desc', value: 'ia proponent', dataTestId: 'bceidRoles2' }
  ]),
  iaSignerOption: vi.fn(() => ({
    label: 'IA Signer',
    header: 'IA Signer',
    text: 'ia signer desc',
    value: 'ia signer'
  }))
}))

vi.mock('@/constants/roles', () => ({
  roles: {
    ia_proponent: 'IA Proponent',
    ia_signer: 'IA Signer'
  }
}))

import { BCeIDSpecificRoleFields } from '../components/BCeIDSpecificRoleFields'
import { bceidRoleOptions, iaSignerOption } from '../_schema'

const t = vi.fn((key) => key)

function makeForm(watchValue = []) {
  return {
    control: { __mockValue: watchValue },
    watch: vi.fn(() => watchValue)
  }
}

describe('BCeIDSpecificRoleFields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    t.mockImplementation((key) => key)
    bceidRoleOptions.mockReturnValue([
      { label: 'Manage Users', header: 'Manage Users', text: 'desc', value: 'manage users', dataTestId: 'bceidRoles1' },
      { label: 'IA Proponent', header: 'IA Proponent', text: 'desc', value: 'ia proponent', dataTestId: 'bceidRoles2' }
    ])
    iaSignerOption.mockReturnValue({
      label: 'IA Signer',
      header: 'IA Signer',
      text: 'ia signer desc',
      value: 'ia signer'
    })
  })

  it('renders the main BCFormCheckbox group for bceidRoles', () => {
    render(<BCeIDSpecificRoleFields form={makeForm()} disabled={false} t={t} />)
    // Global BCFormCheckbox mock renders <div data-test="{name}-checkbox-group">
    expect(screen.getByTestId('bceidRoles-checkbox-group')).toBeInTheDocument()
  })

  it('renders one checkbox per bceidRoleOption', () => {
    render(<BCeIDSpecificRoleFields form={makeForm()} disabled={false} t={t} />)
    // Global mock renders one <input type="checkbox"> per option
    const checkboxes = screen.getAllByRole('checkbox')
    // 2 options from bceidRoleOptions (IA Signer not yet visible — isGovernmentUser false)
    expect(checkboxes).toHaveLength(2)
  })

  it('does NOT render IA Signer section when isGovernmentUser is false (default)', () => {
    render(<BCeIDSpecificRoleFields form={makeForm()} disabled={false} t={t} />)
    expect(screen.queryByTestId('ia-signer-checkbox')).not.toBeInTheDocument()
  })

  it('renders IA Signer checkbox when isGovernmentUser is true', () => {
    render(
      <BCeIDSpecificRoleFields
        form={makeForm()}
        disabled={false}
        t={t}
        isGovernmentUser
      />
    )
    expect(screen.getByTestId('ia-signer-checkbox')).toBeInTheDocument()
  })

  it('IA Signer checkbox is disabled when IA Proponent is not in bceidRoles', () => {
    render(
      <BCeIDSpecificRoleFields
        form={makeForm([])}
        disabled={false}
        t={t}
        isGovernmentUser
      />
    )
    expect(screen.getByTestId('ia-signer-checkbox')).toBeDisabled()
  })

  it('IA Signer checkbox is enabled when IA Proponent is checked', () => {
    render(
      <BCeIDSpecificRoleFields
        form={makeForm(['ia proponent'])}
        disabled={false}
        t={t}
        isGovernmentUser
      />
    )
    expect(screen.getByTestId('ia-signer-checkbox')).not.toBeDisabled()
  })

  it('IA Signer checkbox is disabled when form is globally disabled, even with IA Proponent', () => {
    render(
      <BCeIDSpecificRoleFields
        form={makeForm(['ia proponent'])}
        disabled={true}
        t={t}
        isGovernmentUser
      />
    )
    expect(screen.getByTestId('ia-signer-checkbox')).toBeDisabled()
  })

  it('IA Signer shows as checked when its value is in bceidRoles', () => {
    render(
      <BCeIDSpecificRoleFields
        form={makeForm(['ia proponent', 'ia signer'])}
        disabled={false}
        t={t}
        isGovernmentUser
      />
    )
    expect(screen.getByTestId('ia-signer-checkbox')).toBeChecked()
  })

  it('renders CustomLabel with correct IA Signer header and text', () => {
    render(
      <BCeIDSpecificRoleFields
        form={makeForm()}
        disabled={false}
        t={t}
        isGovernmentUser
      />
    )
    const label = screen.getByTestId('custom-label')
    expect(label).toHaveAttribute('data-header', 'IA Signer')
    expect(label).toHaveAttribute('data-text', 'ia signer desc')
  })

  it('calls iaSignerOption with the translation function', () => {
    render(
      <BCeIDSpecificRoleFields
        form={makeForm()}
        disabled={false}
        t={t}
        isGovernmentUser
      />
    )
    expect(iaSignerOption).toHaveBeenCalledWith(t)
  })

  it('calls bceidRoleOptions with the translation function', () => {
    render(<BCeIDSpecificRoleFields form={makeForm()} disabled={false} t={t} />)
    expect(bceidRoleOptions).toHaveBeenCalledWith(t)
  })
})
