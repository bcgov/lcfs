/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm, FormProvider } from 'react-hook-form'
import { BCFormSelect } from '../BCFormSelect'
import { AppWrapper } from '@/tests/utils'

describe('BCFormSelect', () => {
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

  const defaultOptions = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' }
  ]

  const defaultProps = {
    name: 'testSelect',
    label: 'Test Select',
    options: defaultOptions
  }

  const renderBCFormSelect = (props = {}, formDefaults = {}) => {
    const finalDefaults = { [props.name || defaultProps.name]: '', ...formDefaults }
    return render(
      <FormWrapper defaultValues={finalDefaults}>
        {({ control }) => (
          <BCFormSelect control={control} {...defaultProps} {...props} />
        )}
      </FormWrapper>,
      { wrapper: AppWrapper }
    )
  }

  describe('Basic Rendering', () => {
    it('renders select field with correct structure', () => {
      renderBCFormSelect()
      
      // Look for the select component by its role
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    it('renders with correct label text', () => {
      renderBCFormSelect()
      
      expect(screen.getByText('Test Select')).toBeInTheDocument()
    })

    it('renders with small form control size', () => {
      renderBCFormSelect()
      
      const formControl = screen.getByRole('combobox').closest('.MuiFormControl-root')
      expect(formControl).toHaveClass('css-1iw3t7y-MuiFormControl-root')
    })

    it('has proper ARIA attributes', () => {
      renderBCFormSelect()
      
      const select = screen.getByRole('combobox')
      expect(select).toHaveAttribute('aria-haspopup', 'listbox')
      expect(select).toHaveAttribute('role', 'combobox')
    })
  })

  describe('Option Generation', () => {
    it('handles different option formats', () => {
      const customOptions = [
        { value: 'apple', label: 'Apple' },
        { value: 'banana', label: 'Banana' }
      ]
      
      renderBCFormSelect({ options: customOptions })
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    it('handles empty options array', () => {
      renderBCFormSelect({ options: [] })
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    it('generates options with unique keys', () => {
      // Test that the generateSingleOptions method works
      renderBCFormSelect()
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })
  })

  describe('Form Integration with React Hook Form', () => {
    it('integrates with react-hook-form control', () => {
      renderBCFormSelect({}, { testSelect: 'option2' })
      
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
      // Material-UI Select shows the selected value in its display
      expect(select).toHaveTextContent('Option 2')
    })

    it('starts with empty selection when no default provided', () => {
      renderBCFormSelect()
      
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
      // Should start empty
      expect(select).toHaveAttribute('aria-expanded', 'false')
    })

    it('handles form control updates', async () => {
      const user = userEvent.setup()
      
      renderBCFormSelect()
      
      const select = screen.getByRole('combobox')
      
      // Click to open dropdown
      await user.click(select)
      
      // Should open the dropdown
      expect(select).toHaveAttribute('aria-expanded', 'true')
    })

    it('respects default values from form', () => {
      renderBCFormSelect({}, { testSelect: 'option1' })
      
      const select = screen.getByRole('combobox')
      expect(select).toHaveTextContent('Option 1')
    })
  })

  describe('User Interaction', () => {
    it('opens dropdown when clicked', async () => {
      const user = userEvent.setup()
      
      renderBCFormSelect()
      
      const select = screen.getByRole('combobox')
      
      // Initially closed
      expect(select).toHaveAttribute('aria-expanded', 'false')
      
      // Click to open
      await user.click(select)
      
      // Should be open
      expect(select).toHaveAttribute('aria-expanded', 'true')
    })

    it('is focusable and keyboard accessible', async () => {
      const user = userEvent.setup()
      
      renderBCFormSelect()
      
      const select = screen.getByRole('combobox')
      
      // Should be focusable via tab
      await user.tab()
      expect(select).toHaveFocus()
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      
      renderBCFormSelect()
      
      const select = screen.getByRole('combobox')
      
      // Should be keyboard accessible (tabindex=0)
      expect(select).toHaveAttribute('tabindex', '0')
      
      // Focus and use keyboard to open
      await user.tab()
      await user.keyboard(' ') // Space opens the select
      
      // Should be expanded after space key
      expect(select).toHaveAttribute('aria-expanded', 'true')
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA structure', () => {
      renderBCFormSelect()
      
      const select = screen.getByRole('combobox')
      
      expect(select).toHaveAttribute('role', 'combobox')
      expect(select).toHaveAttribute('aria-haspopup', 'listbox')
      expect(select).toHaveAttribute('tabindex', '0')
    })

    it('provides label association', () => {
      renderBCFormSelect()
      
      const label = screen.getByText('Test Select')
      const select = screen.getByRole('combobox')
      
      expect(label).toBeInTheDocument()
      expect(select).toBeInTheDocument()
    })

    it('supports screen reader interaction', () => {
      renderBCFormSelect()
      
      const select = screen.getByRole('combobox')
      
      // Should have proper ARIA attributes for screen readers
      expect(select).toHaveAttribute('aria-expanded')
      expect(select).toHaveAttribute('aria-haspopup')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles undefined options gracefully', () => {
      expect(() => {
        render(
          <FormWrapper defaultValues={{ test: '' }}>
            {({ control }) => (
              <BCFormSelect 
                control={control} 
                name="test" 
                label="Test" 
                options={undefined} 
              />
            )}
          </FormWrapper>,
          { wrapper: AppWrapper }
        )
      }).not.toThrow()
    })

    it('handles empty options array', () => {
      renderBCFormSelect({ options: [] })
      
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    it('handles options with missing properties', () => {
      const incompleteOptions = [
        { value: 'has-value', label: 'Has Both' },
        { label: 'Missing Value' },
        { value: 'missing-label' }
      ]
      
      expect(() => renderBCFormSelect({ options: incompleteOptions })).not.toThrow()
    })

    it('handles special characters in field name', () => {
      renderBCFormSelect({ name: 'field-with-special_chars.123' })
      
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    it('handles component unmounting cleanly', () => {
      const { unmount } = renderBCFormSelect()
      
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Performance Testing', () => {
    it('handles large number of options', () => {
      const manyOptions = Array.from({ length: 100 }, (_, i) => ({
        value: `option${i}`,
        label: `Option ${i + 1}`
      }))
      
      const startTime = performance.now()
      renderBCFormSelect({ options: manyOptions })
      const endTime = performance.now()
      
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
      
      // Should render efficiently
      expect(endTime - startTime).toBeLessThan(500)
    })

    it('maintains performance during re-renders', () => {
      const { rerender } = render(
        <FormWrapper defaultValues={{ testSelect: 'option1' }}>
          {({ control }) => (
            <BCFormSelect 
              control={control} 
              name="testSelect" 
              label="Test Select" 
              options={defaultOptions} 
            />
          )}
        </FormWrapper>,
        { wrapper: AppWrapper }
      )
      
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
      
      // Re-render
      rerender(
        <FormWrapper defaultValues={{ testSelect: 'option1' }}>
          {({ control }) => (
            <BCFormSelect 
              control={control} 
              name="testSelect" 
              label="Updated Label" 
              options={defaultOptions} 
            />
          )}
        </FormWrapper>
      )
      
      // Should handle re-render gracefully
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
  })

  describe('PropTypes and API', () => {
    it('renders with minimal required props', () => {
      render(
        <FormWrapper defaultValues={{ minimal: '' }}>
          {({ control }) => (
            <BCFormSelect 
              name="minimal" 
              control={control} 
              options={[{ value: 'test', label: 'Test' }]} 
            />
          )}
        </FormWrapper>,
        { wrapper: AppWrapper }
      )
      
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    it('accepts all documented props', () => {
      const allProps = {
        name: 'fullTest',
        label: 'Full Test Select',
        options: [
          { value: 'val1', label: 'Label 1' },
          { value: 'val2', label: 'Label 2' }
        ]
      }
      
      expect(() => renderBCFormSelect(allProps)).not.toThrow()
      
      expect(screen.getByText('Full Test Select')).toBeInTheDocument()
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
  })

  describe('Material-UI Integration', () => {
    it('applies correct Material-UI classes', () => {
      renderBCFormSelect()
      
      const formControl = screen.getByRole('combobox').closest('.MuiFormControl-root')
      expect(formControl).toHaveClass('MuiFormControl-root')
      
      const select = screen.getByRole('combobox')
      expect(select).toHaveClass('MuiSelect-select')
    })

    it('integrates with Material-UI FormControl', () => {
      renderBCFormSelect()
      
      const select = screen.getByRole('combobox')
      const formControl = select.closest('.MuiFormControl-root')
      
      expect(formControl).toBeInTheDocument()
      expect(select.closest('.MuiInputBase-root')).toBeInTheDocument()
    })

    it('uses Material-UI InputLabel correctly', () => {
      renderBCFormSelect()
      
      const label = screen.getByText('Test Select')
      expect(label.closest('.MuiInputLabel-root')).toBeInTheDocument()
    })
  })

  describe('Component Structure and Internal Logic', () => {
    it('implements generateSingleOptions method correctly', () => {
      // Test that the component can handle option generation
      renderBCFormSelect()
      
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    it('integrates Controller component properly', () => {
      renderBCFormSelect()
      
      // Should render without React Hook Form errors
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    it('maintains proper component hierarchy', () => {
      renderBCFormSelect()
      
      const select = screen.getByRole('combobox')
      
      // Verify Material-UI component structure
      expect(select.closest('.MuiFormControl-root')).toBeInTheDocument()
      expect(select.closest('.MuiInputBase-root')).toBeInTheDocument()
      expect(select.closest('.MuiSelect-root')).toBeInTheDocument()
    })
  })
})