import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { IDIRSpecificRoleFields } from '../components/IDIRSpecificRoleFields'

// Mock dependencies
vi.mock('@mui/material', () => ({
  Box: ({ children }) => <div data-test="box">{children}</div>
}))

vi.mock('@/components/BCTypography', () => ({
  __esModule: true,
  default: ({ children, variant, component }) => (
    <span data-test="bc-typography" data-variant={variant} data-component={component}>
      {children}
    </span>
  )
}))

vi.mock('@/components/BCForm', () => ({
  BCFormCheckbox: ({ form, name, options, disabled }) => (
    <div 
      data-test="bc-form-checkbox"
      data-name={name}
      data-disabled={disabled}
      data-options-length={options?.length}
      data-form={JSON.stringify(form)}
    >
      Checkbox Component
    </div>
  ),
  BCFormRadio: ({ control, name, options, disabled }) => (
    <div 
      data-test="bc-form-radio"
      data-name={name}
      data-disabled={disabled}
      data-options-length={options?.length}
      data-control={JSON.stringify(control)}
    >
      Radio Component
    </div>
  )
}))

vi.mock('@/constants/roles', () => ({
  govRoles: [
    'Government',
    'Administrator',
    'Analyst',
    'Compliance Manager',
    'Director'
  ]
}))

vi.mock('../_schema', () => ({
  idirRoleOptions: vi.fn()
}))

// Import the mock after mocking
import { idirRoleOptions } from '../_schema'

describe('IDIRSpecificRoleFields', () => {
  let mockForm, mockT, mockOptions

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockForm = {
      control: { testControl: 'value' }
    }
    
    mockT = vi.fn((key) => `translated-${key}`)
    
    mockOptions = [
      { 
        label: 'Analyst', 
        header: 'Analyst', 
        text: 'translated-admin:userForm.analyst', 
        value: 'analyst' 
      },
      { 
        label: 'Director', 
        header: 'Director', 
        text: 'translated-admin:userForm.director', 
        value: 'director' 
      }
    ]
    
    idirRoleOptions.mockReturnValue(mockOptions)
  })

  it('renders without crashing', () => {
    render(<IDIRSpecificRoleFields form={mockForm} disabled={false} t={mockT} />)
    
    expect(screen.getByTestId('box')).toBeInTheDocument()
  })

  it('renders BCTypography with correct props and translation key', () => {
    render(<IDIRSpecificRoleFields form={mockForm} disabled={false} t={mockT} />)
    
    const typography = screen.getByTestId('bc-typography')
    expect(typography).toBeInTheDocument()
    expect(typography).toHaveAttribute('data-variant', 'label')
    expect(typography).toHaveAttribute('data-component', 'span')
    expect(mockT).toHaveBeenCalledWith('admin:Roles')
    expect(typography).toHaveTextContent('translated-admin:Roles')
  })

  it('calls translation function for dynamic govRoles key', () => {
    render(<IDIRSpecificRoleFields form={mockForm} disabled={false} t={mockT} />)
    
    // Should call t with the dynamic key based on govRoles[1] transformation
    expect(mockT).toHaveBeenCalledWith('admin:userForm.administrator')
  })

  it('performs govRoles[1] access and string manipulation correctly', () => {
    render(<IDIRSpecificRoleFields form={mockForm} disabled={false} t={mockT} />)
    
    const checkbox = screen.getByTestId('bc-form-checkbox')
    const formData = JSON.parse(checkbox.getAttribute('data-form'))
    expect(formData).toEqual(mockForm)
    
    // Verify the string manipulation was performed: 'Administrator'.toLowerCase().replace(' ', '_')
    expect(mockT).toHaveBeenCalledWith('admin:userForm.administrator')
  })

  it('renders BCFormCheckbox with correct props and form object', () => {
    render(<IDIRSpecificRoleFields form={mockForm} disabled={false} t={mockT} />)
    
    const checkbox = screen.getByTestId('bc-form-checkbox')
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).toHaveAttribute('data-name', 'adminRole')
    expect(checkbox).toHaveAttribute('data-options-length', '1')
    expect(checkbox).toHaveAttribute('data-disabled', 'false')
    
    const formData = JSON.parse(checkbox.getAttribute('data-form'))
    expect(formData).toEqual(mockForm)
  })

  it('renders BCFormRadio with correct props and control object', () => {
    render(<IDIRSpecificRoleFields form={mockForm} disabled={false} t={mockT} />)
    
    const radio = screen.getByTestId('bc-form-radio')
    expect(radio).toBeInTheDocument()
    expect(radio).toHaveAttribute('data-name', 'idirRole')
    expect(radio).toHaveAttribute('data-options-length', '2')
    expect(radio).toHaveAttribute('data-disabled', 'false')
    
    const controlData = JSON.parse(radio.getAttribute('data-control'))
    expect(controlData).toEqual(mockForm.control)
  })

  it('destructures control from form object correctly', () => {
    const formWithSpecificControl = {
      control: {
        customProperty: 'customValue',
        anotherProperty: 123
      }
    }
    
    render(<IDIRSpecificRoleFields form={formWithSpecificControl} disabled={false} t={mockT} />)
    
    const radio = screen.getByTestId('bc-form-radio')
    const controlData = JSON.parse(radio.getAttribute('data-control'))
    expect(controlData).toEqual(formWithSpecificControl.control)
  })

  it('passes disabled=false to both form components', () => {
    render(<IDIRSpecificRoleFields form={mockForm} disabled={false} t={mockT} />)
    
    const checkbox = screen.getByTestId('bc-form-checkbox')
    const radio = screen.getByTestId('bc-form-radio')
    
    expect(checkbox).toHaveAttribute('data-disabled', 'false')
    expect(radio).toHaveAttribute('data-disabled', 'false')
  })

  it('passes disabled=true to both form components', () => {
    render(<IDIRSpecificRoleFields form={mockForm} disabled={true} t={mockT} />)
    
    const checkbox = screen.getByTestId('bc-form-checkbox')
    const radio = screen.getByTestId('bc-form-radio')
    
    expect(checkbox).toHaveAttribute('data-disabled', 'true')
    expect(radio).toHaveAttribute('data-disabled', 'true')
  })

  it('calls idirRoleOptions function with translation function', () => {
    render(<IDIRSpecificRoleFields form={mockForm} disabled={false} t={mockT} />)
    
    expect(idirRoleOptions).toHaveBeenCalledWith(mockT)
    expect(idirRoleOptions).toHaveBeenCalledTimes(1)
  })

  it('handles empty idirRoleOptions array', () => {
    idirRoleOptions.mockReturnValue([])
    
    render(<IDIRSpecificRoleFields form={mockForm} disabled={false} t={mockT} />)
    
    const radio = screen.getByTestId('bc-form-radio')
    expect(radio).toHaveAttribute('data-options-length', '0')
  })

  it('renders complete component structure correctly', () => {
    render(<IDIRSpecificRoleFields form={mockForm} disabled={false} t={mockT} />)
    
    const box = screen.getByTestId('box')
    const typography = screen.getByTestId('bc-typography')
    const checkbox = screen.getByTestId('bc-form-checkbox')
    const radio = screen.getByTestId('bc-form-radio')
    
    expect(box).toBeInTheDocument()
    expect(typography).toBeInTheDocument()
    expect(checkbox).toBeInTheDocument()
    expect(radio).toBeInTheDocument()
    
    // Verify structure: all components should be inside box
    expect(box).toContainElement(typography)
    expect(box).toContainElement(checkbox)
    expect(box).toContainElement(radio)
  })

  it('creates admin role option with correct structure', () => {
    render(<IDIRSpecificRoleFields form={mockForm} disabled={false} t={mockT} />)
    
    // Verify the component renders and the dynamic translation key was called
    expect(mockT).toHaveBeenCalledWith('admin:userForm.administrator')
    
    const checkbox = screen.getByTestId('bc-form-checkbox')
    expect(checkbox).toHaveAttribute('data-options-length', '1')
  })

  it('handles undefined form control gracefully', () => {
    const formWithoutControl = {}
    
    render(<IDIRSpecificRoleFields form={formWithoutControl} disabled={false} t={mockT} />)
    
    const radio = screen.getByTestId('bc-form-radio')
    const controlData = JSON.parse(radio.getAttribute('data-control'))
    expect(controlData).toBeNull()
  })

  it('handles translation function returning same key when no translation exists', () => {
    const mockTNoTranslation = vi.fn((key) => key)
    
    render(<IDIRSpecificRoleFields form={mockForm} disabled={false} t={mockTNoTranslation} />)
    
    expect(mockTNoTranslation).toHaveBeenCalledWith('admin:Roles')
    expect(mockTNoTranslation).toHaveBeenCalledWith('admin:userForm.administrator')
    
    const typography = screen.getByTestId('bc-typography')
    expect(typography).toHaveTextContent('admin:Roles')
  })
})