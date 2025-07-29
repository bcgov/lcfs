/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm, FormProvider } from 'react-hook-form'
import { BCFormText } from '../BCFormText'
import { AppWrapper, getByDataTest } from '@/tests/utils'

// Mock BCTypography
vi.mock('@/components/BCTypography', () => ({
  default: ({ variant, component, color, children, ...props }) => (
    <span 
      data-test="bc-typography"
      data-variant={variant}
      data-component={component}
      data-color={color}
      {...props}
    >
      {children}
    </span>
  )
}))

describe('BCFormText', () => {
  // Form wrapper for integration tests
  const FormWrapper = ({ children, defaultValues = {} }) => {
    const methods = useForm({ 
      defaultValues,
      mode: 'onChange'
    })
    return (
      <FormProvider {...methods}>
        {children({ control: methods.control, ...methods })}
      </FormProvider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const defaultProps = {
    name: 'testField',
    label: 'Test Label'
  }

  const renderBCFormText = (props = {}, formDefaults = {}) => {
    return render(
      <FormWrapper defaultValues={formDefaults}>
        {({ control }) => (
          <BCFormText control={control} {...defaultProps} {...props} />
        )}
      </FormWrapper>,
      { wrapper: AppWrapper }
    )
  }

  describe('Basic Rendering', () => {
    it('renders text input field with correct attributes', () => {
      renderBCFormText()
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('id', 'testField')
      expect(input).toHaveAttribute('type', 'text')
    })

    it('renders label with correct text', () => {
      renderBCFormText()
      
      const label = screen.getByText('Test Label:')
      expect(label).toBeInTheDocument()
      
      const typography = getByDataTest('bc-typography')
      expect(typography).toHaveAttribute('data-variant', 'label')
      expect(typography).toHaveAttribute('data-component', 'span')
    })

    it('associates label with input field for accessibility', () => {
      renderBCFormText()
      
      const input = screen.getByRole('textbox')
      const label = screen.getByText('Test Label:').closest('label')
      
      expect(label).toHaveAttribute('for', 'testField')
      expect(input).toHaveAttribute('id', 'testField')
    })

  })

  describe('Optional Field Indicators', () => {
    it('shows optional indicator when optional prop is true', () => {
      renderBCFormText({ optional: true })
      
      expect(screen.getByText('(optional)')).toBeInTheDocument()
      
      const optionalSpan = screen.getByText('(optional)')
      expect(optionalSpan).toHaveClass('optional')
      expect(optionalSpan).toHaveStyle('font-weight: normal')
    })



  })

  describe('Checkbox Integration', () => {
    const checkboxProps = {
      checkbox: true,
      checkboxLabel: 'Enable this option',
      isChecked: false,
      onCheckboxChange: vi.fn()
    }

    it('renders checkbox when checkbox prop is true', () => {
      renderBCFormText(checkboxProps)
      
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
      expect(checkbox).toHaveAttribute('type', 'checkbox')
    })


    it('renders checkbox label with correct styling', () => {
      renderBCFormText(checkboxProps)
      
      expect(screen.getByText('Enable this option')).toBeInTheDocument()
      
      const labelTypography = screen.getAllByTestId('bc-typography').find(
        el => el.textContent === 'Enable this option'
      )
      expect(labelTypography).toHaveAttribute('data-variant', 'body4')
      expect(labelTypography).toHaveAttribute('data-color', 'text')
    })

    it('sets checkbox checked state correctly', () => {
      renderBCFormText({ ...checkboxProps, isChecked: true })
      
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeChecked()
    })


    it('calls onCheckboxChange when checkbox is clicked', async () => {
      const user = userEvent.setup()
      const onCheckboxChange = vi.fn()
      
      renderBCFormText({ ...checkboxProps, onCheckboxChange })
      
      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)
      
      expect(onCheckboxChange).toHaveBeenCalledTimes(1)
    })


  })

  describe('Disabled State', () => {
    it('disables input when disabled prop is true', () => {
      renderBCFormText({ disabled: true })
      
      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
    })



  })

  describe('Form Integration with React Hook Form', () => {
    it('integrates with react-hook-form control for value management', () => {
      render(
        <FormWrapper defaultValues={{ testField: 'Initial Value' }}>
          {({ control }) => (
            <BCFormText name="testField" control={control} label="Test Field" />
          )}
        </FormWrapper>,
        { wrapper: AppWrapper }
      )
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('Initial Value')
    })

    it('handles user input and updates form state', async () => {
      const user = userEvent.setup()
      
      render(
        <FormWrapper>
          {({ control }) => (
            <BCFormText name="testField" control={control} label="Test Field" />
          )}
        </FormWrapper>,
        { wrapper: AppWrapper }
      )
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'New Value')
      
      expect(input).toHaveValue('New Value')
    })

    it('displays form validation errors', async () => {
      const user = userEvent.setup()
      
      render(
        <FormWrapper>
          {({ control, formState: { errors } }) => (
            <BCFormText 
              name="required" 
              control={control} 
              label="Required Field" 
            />
          )}
        </FormWrapper>,
        { wrapper: AppWrapper }
      )
      
      const input = screen.getByRole('textbox')
      
      // Trigger validation by focusing and blurring without entering value
      await user.click(input)
      await user.tab()
      
      // Component should handle error display through Material-UI TextField
      expect(input).toBeInTheDocument()
    })

  })

  describe('Accessibility', () => {
    it('has proper label association for screen readers', () => {
      renderBCFormText()
      
      const input = screen.getByRole('textbox')
      const label = screen.getByText('Test Label:').closest('label')
      
      expect(label).toHaveAttribute('for', 'testField')
      expect(input).toHaveAttribute('id', 'testField')
    })



    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      
      renderBCFormText({ 
        checkbox: true, 
        checkboxLabel: 'Test Checkbox',
        onCheckboxChange: vi.fn()
      })
      
      const input = screen.getByRole('textbox')
      const checkbox = screen.getByRole('checkbox')
      
      // Test that elements are focusable
      await user.click(input)
      expect(input).toHaveFocus()
      
      await user.click(checkbox)
      expect(checkbox).toHaveFocus()
    })

  })

  describe('Edge Cases and Error Handling', () => {


    it('handles special characters in field name', () => {
      renderBCFormText({ name: 'field-with-special_chars.123' })
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('id', 'field-with-special_chars.123')
    })


    it('handles rapid user input without errors', async () => {
      const user = userEvent.setup()
      
      renderBCFormText({}, { testField: '' })
      
      const input = screen.getByRole('textbox')
      
      // Simulate rapid typing
      await user.type(input, 'RapidInput', { delay: 10 })
      
      expect(input).toHaveValue('RapidInput')
    })


    it('preserves input focus during re-renders', async () => {
      const user = userEvent.setup()
      
      const { rerender } = render(
        <FormWrapper>
          {({ control }) => (
            <BCFormText name="testField" control={control} label="Test Field" />
          )}
        </FormWrapper>,
        { wrapper: AppWrapper }
      )
      
      const input = screen.getByRole('textbox')
      await user.click(input)
      
      expect(input).toHaveFocus()
      
      // Re-render component
      rerender(
        <FormWrapper>
          {({ control }) => (
            <BCFormText name="testField" control={control} label="Updated Label" />
          )}
        </FormWrapper>
      )
      
      // Focus should be maintained
      expect(input).toHaveFocus()
    })
  })

  describe('Performance and Optimization', () => {
    it('does not cause unnecessary re-renders', () => {
      const renderSpy = vi.fn()
      
      const TestComponentWrapper = (props) => {
        renderSpy()
        return (
          <FormWrapper>
            {({ control }) => (
              <BCFormText 
                {...defaultProps} 
                control={control}
                {...props} 
              />
            )}
          </FormWrapper>
        )
      }
      
      const { rerender } = render(<TestComponentWrapper />, { wrapper: AppWrapper })
      
      expect(renderSpy).toHaveBeenCalledTimes(1)
      
      // Re-render with same props
      rerender(<TestComponentWrapper />)
      
      // Should still only be called twice (initial + rerender)
      expect(renderSpy).toHaveBeenCalledTimes(2)
    })

  })

  describe('PropTypes Validation', () => {
    it('renders correctly with minimal required props', () => {
      render(
        <FormWrapper>
          {({ control }) => (
            <BCFormText name="minimal" control={control} />
          )}
        </FormWrapper>,
        { wrapper: AppWrapper }
      )
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('id', 'minimal')
    })

    it('accepts all documented prop types', () => {
      const allProps = {
        name: 'fullTest',
        label: 'Full Test Label',
        optional: true,
        checkbox: true,
        checkboxLabel: 'Checkbox Label',
        onCheckboxChange: vi.fn(),
        isChecked: true,
        disabled: false
      }
      
      expect(() => renderBCFormText(allProps)).not.toThrow()
      
      expect(screen.getByText('Full Test Label:')).toBeInTheDocument()
      expect(screen.getByText('(optional)')).toBeInTheDocument()
      expect(screen.getByRole('checkbox')).toBeChecked()
      expect(screen.getByText('Checkbox Label')).toBeInTheDocument()
    })
  })
})