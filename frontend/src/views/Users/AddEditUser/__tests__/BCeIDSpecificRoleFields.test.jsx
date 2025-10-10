import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock external dependencies first, before importing the component
vi.mock('@mui/material', () => ({
  Box: ({ children }) => <div data-test="box">{children}</div>
}))

vi.mock('@/components/BCTypography', () => ({
  __esModule: true,
  default: ({ children, variant, component }) => (
    <span
      data-test="bc-typography"
      data-variant={variant}
      data-component={component}
    >
      {children}
    </span>
  )
}))

vi.mock('@/components/BCForm', () => ({
  BCFormCheckbox: ({ form, name, label, options, disabled }) => (
    <div
      data-test="bc-form-checkbox"
      data-name={name}
      data-label={label}
      data-disabled={disabled}
      data-options-length={options?.length}
    >
      Checkbox Component
    </div>
  )
}))

vi.mock('../_schema', () => ({
  bceidRoleOptions: vi.fn()
}))

// Import the component and mocked schema function
import { BCeIDSpecificRoleFields } from '../components/BCeIDSpecificRoleFields'
import { bceidRoleOptions } from '../_schema'

describe('BCeIDSpecificRoleFields', () => {
  let mockForm, mockT, mockOptions

  beforeEach(() => {
    vi.clearAllMocks()

    mockForm = {
      control: {}
    }

    mockT = vi.fn((key) => `translated-${key}`)

    mockOptions = [
      {
        label: 'Role 1',
        header: 'Role 1',
        text: 'Role 1 description',
        value: 'role1'
      },
      {
        label: 'Role 2',
        header: 'Role 2',
        text: 'Role 2 description',
        value: 'role2'
      }
    ]

    bceidRoleOptions.mockReturnValue(mockOptions)
  })

  it('renders without crashing', () => {
    render(
      <BCeIDSpecificRoleFields form={mockForm} disabled={false} t={mockT} />
    )

    expect(screen.getByTestId('box')).toBeInTheDocument()
  })

  it('passes label with correct translation key to BCFormCheckbox', () => {
    render(
      <BCeIDSpecificRoleFields form={mockForm} disabled={false} t={mockT} />
    )

    const checkbox = screen.getByTestId('bc-form-checkbox')
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).toHaveAttribute('data-label', 'translated-admin:Roles')
    expect(mockT).toHaveBeenCalledWith('admin:Roles')
  })

  it('renders BCFormCheckbox with correct props', () => {
    render(
      <BCeIDSpecificRoleFields form={mockForm} disabled={false} t={mockT} />
    )

    const checkbox = screen.getByTestId('bc-form-checkbox')
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).toHaveAttribute('data-name', 'bceidRoles')
    expect(checkbox).toHaveAttribute('data-options-length', '2')
  })

  it('passes form object to BCFormCheckbox', () => {
    const customForm = { control: { customProp: 'test' } }
    render(
      <BCeIDSpecificRoleFields form={customForm} disabled={false} t={mockT} />
    )

    const checkbox = screen.getByTestId('bc-form-checkbox')
    expect(checkbox).toBeInTheDocument()
  })

  it('passes disabled prop as false to BCFormCheckbox', () => {
    render(
      <BCeIDSpecificRoleFields form={mockForm} disabled={false} t={mockT} />
    )

    const checkbox = screen.getByTestId('bc-form-checkbox')
    expect(checkbox).toHaveAttribute('data-disabled', 'false')
  })

  it('passes disabled prop as true to BCFormCheckbox', () => {
    render(
      <BCeIDSpecificRoleFields form={mockForm} disabled={true} t={mockT} />
    )

    const checkbox = screen.getByTestId('bc-form-checkbox')
    expect(checkbox).toHaveAttribute('data-disabled', 'true')
  })

  it('calls bceidRoleOptions with translation function', () => {
    render(
      <BCeIDSpecificRoleFields form={mockForm} disabled={false} t={mockT} />
    )

    expect(bceidRoleOptions).toHaveBeenCalledWith(mockT)
    expect(bceidRoleOptions).toHaveBeenCalledTimes(1)
  })

  it('destructures control from form object', () => {
    const formWithControl = {
      control: {
        test: 'value'
      }
    }

    render(
      <BCeIDSpecificRoleFields
        form={formWithControl}
        disabled={false}
        t={mockT}
      />
    )

    // Component renders successfully, indicating control was destructured properly
    expect(screen.getByTestId('bc-form-checkbox')).toBeInTheDocument()
  })

  it('handles empty options array', () => {
    bceidRoleOptions.mockReturnValue([])

    render(
      <BCeIDSpecificRoleFields form={mockForm} disabled={false} t={mockT} />
    )

    const checkbox = screen.getByTestId('bc-form-checkbox')
    expect(checkbox).toHaveAttribute('data-options-length', '0')
  })

  it('renders all required components in correct structure', () => {
    render(
      <BCeIDSpecificRoleFields form={mockForm} disabled={false} t={mockT} />
    )

    const box = screen.getByTestId('box')
    const checkbox = screen.getByTestId('bc-form-checkbox')

    expect(box).toBeInTheDocument()
    expect(checkbox).toBeInTheDocument()

    // Verify structure: checkbox should be inside box
    expect(box).toContainElement(checkbox)

    // Verify the checkbox has the label prop
    expect(checkbox).toHaveAttribute('data-label', 'translated-admin:Roles')
  })
})
