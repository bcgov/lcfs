import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vite-plus/test'

import { BCeIDSpecificRoleFields } from '../components/BCeIDSpecificRoleFields'
import {
  bceidRoleOptions,
  iaSignerOption,
  lcjfipAdministratorOption
} from '../_schema'

// @/components/BCForm is globally mocked in testSetup.ts:
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
  Controller: ({ control, render: renderFn }) =>
    renderFn({
      field: {
        onChange: vi.fn(),
        value: control?.__mockValue ?? []
      }
    })
}))

vi.mock('@mui/material/Box', () => ({
  default: ({ children }) => <div data-test="box">{children}</div>
}))

vi.mock('@mui/material/FormControl', () => ({
  default: ({ children }) => <div data-test="form-control">{children}</div>
}))

vi.mock('@mui/material/FormControlLabel', () => ({
  default: ({ control: ctrl, label }) => (
    <div data-test="form-control-label">
      {ctrl}
      {label}
    </div>
  )
}))

vi.mock('@mui/material/Checkbox', () => ({
  default: ({ id, checked, disabled }) => (
    <input
      data-test={`${id}-checkbox`}
      id={id}
      type="checkbox"
      defaultChecked={checked}
      disabled={disabled}
      readOnly
    />
  )
}))

const MANAGE_USERS_OPTION = {
  label: 'Manage Users',
  header: 'Manage Users',
  text: 'desc',
  value: 'manage users',
  dataTestId: 'bceidRoles1'
}
const IA_PROPONENT_OPTION = {
  label: 'IA Proponent',
  header: 'IA Proponent',
  text: 'desc',
  value: 'ia proponent',
  dataTestId: 'bceidRoles2'
}
const LCJFIP_APPLICANT_OPTION = {
  label: 'LCJFIP Applicant',
  header: 'LCJFIP Applicant',
  text: 'desc',
  value: 'lcjfip applicant',
  dataTestId: 'bceidRoles3'
}

// Mirrors the real semantics: null availableRoles = no filtering; a parent
// option is offered only when available to the organization.
const mockBceidRoleOptions = (_t, availableRoles = null) => [
  MANAGE_USERS_OPTION,
  ...(availableRoles == null || availableRoles.includes('IA Proponent')
    ? [IA_PROPONENT_OPTION]
    : []),
  ...(availableRoles != null && availableRoles.includes('LCJFIP Applicant')
    ? [LCJFIP_APPLICANT_OPTION]
    : [])
]

vi.mock('../_schema', () => ({
  bceidRoleOptions: vi.fn(),
  iaSignerOption: vi.fn(() => ({
    label: 'IA Signer',
    header: 'IA Signer',
    text: 'ia signer desc',
    value: 'ia signer'
  })),
  lcjfipAdministratorOption: vi.fn(() => ({
    label: 'LCJFIP Administrator',
    header: 'LCJFIP Administrator',
    text: 'lcjfip administrator desc',
    value: 'lcjfip administrator'
  }))
}))

vi.mock('@/constants/roles', () => ({
  roles: {
    ia_proponent: 'IA Proponent',
    ia_signer: 'IA Signer',
    lcjfip_applicant: 'LCJFIP Applicant',
    lcjfip_administrator: 'LCJFIP Administrator'
  }
}))

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
    bceidRoleOptions.mockImplementation(mockBceidRoleOptions)
    iaSignerOption.mockReturnValue({
      label: 'IA Signer',
      header: 'IA Signer',
      text: 'ia signer desc',
      value: 'ia signer'
    })
    lcjfipAdministratorOption.mockReturnValue({
      label: 'LCJFIP Administrator',
      header: 'LCJFIP Administrator',
      text: 'lcjfip administrator desc',
      value: 'lcjfip administrator'
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

  it('calls bceidRoleOptions with the translation function and availability', () => {
    render(<BCeIDSpecificRoleFields form={makeForm()} disabled={false} t={t} />)
    expect(bceidRoleOptions).toHaveBeenCalledWith(t, null)
  })

  it('passes the org availableRoles through to bceidRoleOptions', () => {
    render(
      <BCeIDSpecificRoleFields
        form={makeForm()}
        disabled={false}
        t={t}
        availableRoles={['Transfer']}
      />
    )
    expect(bceidRoleOptions).toHaveBeenCalledWith(t, ['Transfer'])
  })

  it('hides IA Signer when IA Proponent is not available to the org', () => {
    render(
      <BCeIDSpecificRoleFields
        form={makeForm(['ia proponent'])}
        disabled={false}
        t={t}
        isGovernmentUser
        availableRoles={['Transfer']}
      />
    )
    expect(screen.queryByTestId('ia-signer-checkbox')).not.toBeInTheDocument()
  })

  it('shows IA Signer when IA Proponent is available to the org', () => {
    render(
      <BCeIDSpecificRoleFields
        form={makeForm(['ia proponent'])}
        disabled={false}
        t={t}
        isGovernmentUser
        availableRoles={['IA Proponent']}
      />
    )
    expect(screen.getByTestId('ia-signer-checkbox')).toBeInTheDocument()
  })

  it('renders LCJFIP Administrator directly under LCJFIP Applicant for IDIR editors', () => {
    render(
      <BCeIDSpecificRoleFields
        form={makeForm(['lcjfip applicant'])}
        disabled={false}
        t={t}
        isGovernmentUser
        availableRoles={['IA Proponent', 'LCJFIP Applicant']}
      />
    )
    const admin = screen.getByTestId('lcjfip-administrator-checkbox')
    expect(admin).toBeInTheDocument()
    expect(admin).not.toBeDisabled()
    expect(
      screen.getAllByRole('checkbox').map((c) => c.getAttribute('data-test'))
    ).toEqual([
      'bceidRoles1',
      'bceidRoles2',
      'ia-signer-checkbox',
      'bceidRoles3',
      'lcjfip-administrator-checkbox'
    ])
  })

  it('allows LCJFIP Administrator without a user Applicant assignment', () => {
    render(
      <BCeIDSpecificRoleFields
        form={makeForm([])}
        disabled={false}
        t={t}
        isGovernmentUser
        availableRoles={['LCJFIP Applicant']}
      />
    )
    expect(
      screen.getByTestId('lcjfip-administrator-checkbox')
    ).not.toBeDisabled()
  })

  it('preserves a checked LCJFIP Administrator without a user Applicant assignment', () => {
    render(
      <BCeIDSpecificRoleFields
        form={makeForm(['lcjfip administrator'])}
        disabled={false}
        t={t}
        isGovernmentUser
        availableRoles={['LCJFIP Applicant']}
      />
    )
    expect(screen.getByTestId('lcjfip-administrator-checkbox')).toBeChecked()
    expect(
      screen.getByTestId('lcjfip-administrator-checkbox')
    ).not.toBeDisabled()
  })

  it('disables LCJFIP Administrator when the form is disabled', () => {
    render(
      <BCeIDSpecificRoleFields
        form={makeForm(['lcjfip administrator'])}
        disabled
        t={t}
        isGovernmentUser
        availableRoles={['LCJFIP Applicant']}
      />
    )
    expect(screen.getByTestId('lcjfip-administrator-checkbox')).toBeDisabled()
  })

  it('hides LCJFIP Administrator when LCJFIP Applicant is not available to the org', () => {
    render(
      <BCeIDSpecificRoleFields
        form={makeForm(['lcjfip applicant'])}
        disabled={false}
        t={t}
        isGovernmentUser
        availableRoles={['IA Proponent']}
      />
    )
    expect(
      screen.queryByTestId('lcjfip-administrator-checkbox')
    ).not.toBeInTheDocument()
  })

  it('does not show LCJFIP Administrator to BCeID editors', () => {
    render(
      <BCeIDSpecificRoleFields
        form={makeForm(['lcjfip applicant'])}
        disabled={false}
        t={t}
        availableRoles={['LCJFIP Applicant']}
      />
    )
    expect(
      screen.queryByTestId('lcjfip-administrator-checkbox')
    ).not.toBeInTheDocument()
  })
})
