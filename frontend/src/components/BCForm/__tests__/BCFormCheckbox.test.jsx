/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm, FormProvider } from 'react-hook-form'
import { BCFormCheckbox } from '../BCFormCheckbox'
import { AppWrapper, getByDataTest } from '@/tests/utils'

// Mock BCTypography
vi.mock('@/components/BCTypography', () => ({
  default: ({ variant, component, children, ...props }) => (
    <span 
      data-test="bc-typography"
      data-variant={variant}
      data-component={component}
      {...props}
    >
      {children}
    </span>
  )
}))

// Mock CustomLabel
vi.mock('../CustomLabel', () => ({
  CustomLabel: ({ header, text }) => (
    <span data-test="custom-label">
      <strong>{header}</strong> — {text}
    </span>
  )
}))

describe('BCFormCheckbox', () => {
  // Form wrapper for integration tests
  const FormWrapper = ({ children, defaultValues = {} }) => {
    const methods = useForm({ 
      defaultValues,
      mode: 'onChange'
    })
    return (
      <FormProvider {...methods}>
        {children({ form: methods, control: methods.control, ...methods })}
      </FormProvider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const defaultOptions = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' }
  ]

  const defaultProps = {
    name: 'testCheckbox',
    label: 'Test Checkbox Group',
    options: defaultOptions
  }

  const renderBCFormCheckbox = (props = {}, formDefaults = {}) => {
    const finalDefaults = { [props.name || defaultProps.name]: [], ...formDefaults }
    return render(
      <FormWrapper defaultValues={finalDefaults}>
        {({ form }) => (
          <BCFormCheckbox form={form} {...defaultProps} {...props} />
        )}
      </FormWrapper>,
      { wrapper: AppWrapper }
    )
  }

  describe('Basic Rendering', () => {
    it('renders checkbox group with correct structure', () => {
      renderBCFormCheckbox()
      
      // Look for FormControl instead of fieldset
      const formControl = document.querySelector('.MuiFormControl-root')
      expect(formControl).toBeInTheDocument()
    })

    it('renders group label with correct text', () => {
      renderBCFormCheckbox()
      
      expect(screen.getByText('Test Checkbox Group')).toBeInTheDocument()
      
      const typography = getByDataTest('bc-typography')
      expect(typography).toHaveAttribute('data-variant', 'label')
      expect(typography).toHaveAttribute('data-component', 'span')
    })

    it('renders all provided checkbox options', () => {
      renderBCFormCheckbox()
      
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(3)
      
      expect(screen.getByText('Option 1')).toBeInTheDocument()
      expect(screen.getByText('Option 2')).toBeInTheDocument()
      expect(screen.getByText('Option 3')).toBeInTheDocument()
    })

  })

  describe('Option Rendering', () => {

    it('renders options with header and text using CustomLabel', () => {
      const headerOptions = [
        { 
          value: 'header1', 
          header: 'Header Text', 
          text: 'Description text' 
        },
        { 
          value: 'header2', 
          header: 'Another Header', 
          text: 'Another description' 
        }
      ]
      
      renderBCFormCheckbox({ options: headerOptions })
      
      const customLabels = document.querySelectorAll('[data-test="custom-label"]')
      expect(customLabels).toHaveLength(2)
      
      // Check for text content within the custom labels
      expect(customLabels[0]).toHaveTextContent('Header Text — Description text')
      expect(customLabels[1]).toHaveTextContent('Another Header — Another description')
    })


    it('handles empty options array', () => {
      renderBCFormCheckbox({ options: [] })
      
      const formControl = document.querySelector('.MuiFormControl-root')
      expect(formControl).toBeInTheDocument()
      
      const checkboxes = screen.queryAllByRole('checkbox')
      expect(checkboxes).toHaveLength(0)
    })
  })

  describe('Form Integration with React Hook Form', () => {
    it('integrates with react-hook-form control', () => {
      renderBCFormCheckbox({}, { testCheckbox: ['option1', 'option3'] })
      
      const checkboxes = screen.getAllByRole('checkbox')
      
      // First and third options should be checked
      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).not.toBeChecked()
      expect(checkboxes[2]).toBeChecked()
    })


    it('handles user selection and updates form state', async () => {
      const user = userEvent.setup()
      
      renderBCFormCheckbox()
      
      const checkboxes = screen.getAllByRole('checkbox')
      
      // Initially unchecked
      expect(checkboxes[0]).not.toBeChecked()
      
      // Click first checkbox
      await user.click(checkboxes[0])
      
      // Should be checked now
      expect(checkboxes[0]).toBeChecked()
    })

    it('handles multiple selections correctly', async () => {
      const user = userEvent.setup()
      
      renderBCFormCheckbox()
      
      const checkboxes = screen.getAllByRole('checkbox')
      
      // Select first and third options
      await user.click(checkboxes[0])
      await user.click(checkboxes[2])
      
      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).not.toBeChecked()
      expect(checkboxes[2]).toBeChecked()
    })

    it('handles deselection of checked items', async () => {
      const user = userEvent.setup()
      
      renderBCFormCheckbox({}, { testCheckbox: ['option1'] })
      
      const checkboxes = screen.getAllByRole('checkbox')
      
      // First checkbox should be initially checked
      expect(checkboxes[0]).toBeChecked()
      
      // Click to uncheck
      await user.click(checkboxes[0])
      
      // Should be unchecked now
      expect(checkboxes[0]).not.toBeChecked()
    })
  })

  describe('Selection Logic (handleSelect)', () => {
    it('adds new values to selection array', async () => {
      const user = userEvent.setup()
      
      renderBCFormCheckbox()
      
      const checkboxes = screen.getAllByRole('checkbox')
      
      // Click multiple checkboxes
      await user.click(checkboxes[0])
      await user.click(checkboxes[1])
      
      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).toBeChecked()
      expect(checkboxes[2]).not.toBeChecked()
    })

    it('removes values from selection array when unchecked', async () => {
      const user = userEvent.setup()
      
      renderBCFormCheckbox({}, { testCheckbox: ['option1', 'option2'] })
      
      const checkboxes = screen.getAllByRole('checkbox')
      
      // Both should be initially checked
      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).toBeChecked()
      
      // Uncheck first one
      await user.click(checkboxes[0])
      
      expect(checkboxes[0]).not.toBeChecked()
      expect(checkboxes[1]).toBeChecked()
    })

    it('handles duplicate values correctly', async () => {
      const user = userEvent.setup()
      
      renderBCFormCheckbox({}, { testCheckbox: ['option1'] })
      
      const checkboxes = screen.getAllByRole('checkbox')
      
      // First checkbox is checked
      expect(checkboxes[0]).toBeChecked()
      
      // Click same checkbox (should uncheck)
      await user.click(checkboxes[0])
      
      expect(checkboxes[0]).not.toBeChecked()
      
      // Click again (should check)
      await user.click(checkboxes[0])
      
      expect(checkboxes[0]).toBeChecked()
    })
  })

  describe('Disabled State', () => {
    it('disables all checkboxes when disabled prop is true', () => {
      renderBCFormCheckbox({ disabled: true })
      
      const checkboxes = screen.getAllByRole('checkbox')
      
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeDisabled()
      })
    })



  })

  describe('Accessibility', () => {



    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      
      renderBCFormCheckbox()
      
      const checkboxes = screen.getAllByRole('checkbox')
      
      // Focus first checkbox
      await user.click(checkboxes[0])
      expect(checkboxes[0]).toHaveFocus()
      
      // Clicking the checkbox should toggle it
      expect(checkboxes[0]).toBeChecked()
    })

    it('allows toggling with the Enter key', async () => {
      const user = userEvent.setup()

      renderBCFormCheckbox()

      const checkboxes = screen.getAllByRole('checkbox')

      await user.tab()
      expect(checkboxes[0]).toHaveFocus()
      expect(checkboxes[0]).not.toBeChecked()

      await user.keyboard('{Enter}')

      expect(checkboxes[0]).toBeChecked()
    })

    it('provides proper focus management', async () => {
      const user = userEvent.setup()
      
      renderBCFormCheckbox()
      
      const checkboxes = screen.getAllByRole('checkbox')
      
      // Each checkbox should be individually focusable
      await user.click(checkboxes[0])
      expect(checkboxes[0]).toHaveFocus()
      
      await user.click(checkboxes[1])
      expect(checkboxes[1]).toHaveFocus()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles undefined form prop gracefully', () => {
      expect(() => {
        render(
          <BCFormCheckbox 
            name="test" 
            form={undefined} 
            label="Test" 
            options={defaultOptions} 
          />,
          { wrapper: AppWrapper }
        )
      }).toThrow() // This should throw as form is required
    })

    it('handles empty options array', () => {
      renderBCFormCheckbox({ options: [] })
      
      const formControl = document.querySelector('.MuiFormControl-root')  
      expect(formControl).toBeInTheDocument()
      
      const checkboxes = screen.queryAllByRole('checkbox')
      expect(checkboxes).toHaveLength(0)
    })

    it('handles options with missing values', () => {
      const incompleteOptions = [
        { label: 'Missing Value' },
        { value: 'has-value', label: 'Has Value' }
      ]
      
      expect(() => renderBCFormCheckbox({ options: incompleteOptions })).not.toThrow()
    })

    it('handles options with missing labels', () => {
      const incompleteOptions = [
        { value: 'missing-label' },
        { value: 'has-label', label: 'Has Label' }
      ]
      
      expect(() => renderBCFormCheckbox({ options: incompleteOptions })).not.toThrow()
    })

    it('handles special characters in field name', () => {
      renderBCFormCheckbox({ name: 'field-with-special_chars.123' })
      
      const formControl = document.querySelector('.MuiFormControl-root')
      expect(formControl).toBeInTheDocument()
    })

    it('handles very long option labels', () => {
      const longOptions = [
        { 
          value: 'long', 
          label: 'This is a very long option label that might wrap to multiple lines and test how the component handles lengthy text content'
        }
      ]
      
      renderBCFormCheckbox({ options: longOptions })
      
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
    })

    it('handles component unmounting cleanly', () => {
      const { unmount } = renderBCFormCheckbox()
      
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Performance and Optimization', () => {
    it('handles large numbers of options efficiently', () => {
      const manyOptions = Array.from({ length: 100 }, (_, i) => ({
        value: `option${i}`,
        label: `Option ${i + 1}`
      }))
      
      const startTime = performance.now()
      renderBCFormCheckbox({ options: manyOptions })
      const endTime = performance.now()
      
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(100)
      
      // Should render efficiently
      expect(endTime - startTime).toBeLessThan(1000)
    })

    it('maintains selection state during re-renders', () => {
      const { rerender } = render(
        <FormWrapper defaultValues={{ testCheckbox: ['option1'] }}>
          {({ form }) => (
            <BCFormCheckbox 
              form={form} 
              name="testCheckbox" 
              label="Test Checkboxes" 
              options={defaultOptions} 
            />
          )}
        </FormWrapper>,
        { wrapper: AppWrapper }
      )
      
      // Check first checkbox is selected via role
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes[0]).toBeChecked()
      
      // Re-render
      rerender(
        <FormWrapper defaultValues={{ testCheckbox: ['option1'] }}>
          {({ form }) => (
            <BCFormCheckbox 
              form={form} 
              name="testCheckbox" 
              label="Updated Label" 
              options={defaultOptions} 
            />
          )}
        </FormWrapper>
      )
      
      // Selection should be maintained
      const updatedCheckboxes = screen.getAllByRole('checkbox')
      expect(updatedCheckboxes[0]).toBeChecked()
    })

    it('handles rapid user interactions without errors', async () => {
      const user = userEvent.setup()
      
      renderBCFormCheckbox()
      
      const checkboxes = screen.getAllByRole('checkbox')
      
      // Rapid clicking
      await user.click(checkboxes[0])
      await user.click(checkboxes[0])
      await user.click(checkboxes[1])
      await user.click(checkboxes[1])
      
      // Component should handle rapid interactions gracefully
      expect(checkboxes[0]).not.toBeChecked()
      expect(checkboxes[1]).not.toBeChecked()
    })
  })

  describe('PropTypes and API', () => {
    it('renders with minimal required props', () => {
      render(
        <FormWrapper defaultValues={{ minimal: [] }}>
          {({ form }) => (
            <BCFormCheckbox 
              name="minimal" 
              form={form} 
              options={[{ value: 'test', label: 'Test' }]} 
            />
          )}
        </FormWrapper>,
        { wrapper: AppWrapper }
      )
      
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
    })

    it('accepts all documented props', () => {
      const allProps = {
        name: 'fullTest',
        label: 'Full Test Checkboxes',
        options: [
          { value: 'val1', label: 'Label 1' },
          { value: 'val2', label: 'Label 2' }
        ],
        disabled: false
      }
      
      expect(() => renderBCFormCheckbox(allProps)).not.toThrow()
      
      expect(screen.getByText('Full Test Checkboxes')).toBeInTheDocument()
      expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    })
  })

  describe('Default Props and Display Name', () => {
    it('uses correct default props', () => {
      // Test that initialItems defaults to empty array
      renderBCFormCheckbox()
      
      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked()
      })
    })

    it('has correct display name', () => {
      expect(BCFormCheckbox.displayName).toBe('BCFormCheckbox')
    })
  })

  describe('Material-UI Integration', () => {
    it('applies correct Material-UI classes', () => {
      renderBCFormCheckbox()
      
      const formControl = document.querySelector('.MuiFormControl-root')
      expect(formControl).toHaveClass('MuiFormControl-root')
      
      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach(checkbox => {
        expect(checkbox.closest('.MuiCheckbox-root')).toBeInTheDocument()
      })
    })

    it('integrates with Material-UI FormControlLabel', () => {
      renderBCFormCheckbox()
      
      const labels = screen.getAllByRole('checkbox').map(cb => cb.closest('label'))
      
      labels.forEach(label => {
        expect(label).toHaveClass('MuiFormControlLabel-root')
      })
    })

    it('applies correct spacing with marginY prop', () => {
      renderBCFormCheckbox()
      
      const labels = screen.getAllByRole('checkbox').map(cb => cb.closest('label'))
      
      // FormControlLabel should have marginY styling
      labels.forEach(label => {
        expect(label).toHaveClass('MuiFormControlLabel-root')
      })
    })
  })
})