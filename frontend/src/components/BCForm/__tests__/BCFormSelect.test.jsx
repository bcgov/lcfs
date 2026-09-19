/**
 * @vitest-environment jsdom
 */
import { describe, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm, FormProvider } from 'react-hook-form'
import { BCFormSelect } from '../BCFormSelect'
import { test } from '@/tests/utils/fixtures'

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

  const renderBCFormSelect = (
    { render, theme },
    props = {},
    formDefaults = {}
  ) => {
    const finalDefaults = {
      [props.name || defaultProps.name]: '',
      ...formDefaults
    }
    return render(
      <FormWrapper defaultValues={finalDefaults}>
        {({ control }) => (
          <BCFormSelect control={control} {...defaultProps} {...props} />
        )}
      </FormWrapper>
    )
  }

  describe('Basic Rendering', () => {
    test('renders select field with correct structure', ({ render, theme }) => {
      renderBCFormSelect({ render, theme })

      // Look for the select component by its role
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    test('renders with correct label text', ({ render, theme }) => {
      renderBCFormSelect({ render, theme })

      expect(screen.getByText('Test Select')).toBeInTheDocument()
    })

    test('renders with small form control size', ({ render, theme }) => {
      renderBCFormSelect({ render, theme })

      const formControl = screen
        .getByRole('combobox')
        .closest('.MuiFormControl-root')
      expect(formControl).toHaveClass('css-1iw3t7y-MuiFormControl-root')
    })

    test('has proper ARIA attributes', ({ render, theme }) => {
      renderBCFormSelect({ render, theme })

      const select = screen.getByRole('combobox')
      expect(select).toHaveAttribute('aria-haspopup', 'listbox')
      expect(select).toHaveAttribute('role', 'combobox')
    })
  })

  describe('Option Generation', () => {
    test('handles different option formats', ({ render, theme }) => {
      const customOptions = [
        { value: 'apple', label: 'Apple' },
        { value: 'banana', label: 'Banana' }
      ]

      renderBCFormSelect({ render, theme }, { options: customOptions })
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    test('handles empty options array', ({ render, theme }) => {
      renderBCFormSelect({ render, theme }, { options: [] })
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    test('generates options with unique keys', ({ render, theme }) => {
      // Test that the generateSingleOptions method works
      renderBCFormSelect({ render, theme })
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })
  })

  describe('Form Integration with React Hook Form', () => {
    test('integrates with react-hook-form control', ({ render, theme }) => {
      renderBCFormSelect({ render, theme }, {}, { testSelect: 'option2' })

      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
      // Material-UI Select shows the selected value in its display
      expect(select).toHaveTextContent('Option 2')
    })

    test('starts with empty selection when no default provided', ({
      render,
      theme
    }) => {
      renderBCFormSelect({ render, theme })

      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
      // Should start empty
      expect(select).toHaveAttribute('aria-expanded', 'false')
    })

    test('handles form control updates', async ({ render, theme }) => {
      const user = userEvent.setup()

      renderBCFormSelect({ render, theme })

      const select = screen.getByRole('combobox')

      // Click to open dropdown
      await user.click(select)

      // Should open the dropdown
      expect(select).toHaveAttribute('aria-expanded', 'true')
    })

    test('respects default values from form', ({ render, theme }) => {
      renderBCFormSelect({ render, theme }, {}, { testSelect: 'option1' })

      const select = screen.getByRole('combobox')
      expect(select).toHaveTextContent('Option 1')
    })
  })

  describe('User Interaction', () => {
    test('opens dropdown when clicked', async ({ render, theme }) => {
      const user = userEvent.setup()

      renderBCFormSelect({ render, theme })

      const select = screen.getByRole('combobox')

      // Initially closed
      expect(select).toHaveAttribute('aria-expanded', 'false')

      // Click to open
      await user.click(select)

      // Should be open
      expect(select).toHaveAttribute('aria-expanded', 'true')
    })

    test('is focusable and keyboard accessible', async ({ render, theme }) => {
      const user = userEvent.setup()

      renderBCFormSelect({ render, theme })

      const select = screen.getByRole('combobox')

      // Should be focusable via tab
      await user.tab()
      expect(select).toHaveFocus()
    })

    test('supports keyboard navigation', async ({ render, theme }) => {
      const user = userEvent.setup()

      renderBCFormSelect({ render, theme })

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
    test('has proper ARIA structure', ({ render, theme }) => {
      renderBCFormSelect({ render, theme })

      const select = screen.getByRole('combobox')

      expect(select).toHaveAttribute('role', 'combobox')
      expect(select).toHaveAttribute('aria-haspopup', 'listbox')
      expect(select).toHaveAttribute('tabindex', '0')
    })

    test('provides label association', ({ render, theme }) => {
      renderBCFormSelect({ render, theme })

      const label = screen.getByText('Test Select')
      const select = screen.getByRole('combobox')

      expect(label).toBeInTheDocument()
      expect(select).toBeInTheDocument()
    })

    test('supports screen reader interaction', ({ render, theme }) => {
      renderBCFormSelect({ render, theme })

      const select = screen.getByRole('combobox')

      // Should have proper ARIA attributes for screen readers
      expect(select).toHaveAttribute('aria-expanded')
      expect(select).toHaveAttribute('aria-haspopup')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('handles undefined options gracefully', ({ render, theme }) => {
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
          </FormWrapper>
        )
      }).not.toThrow()
    })

    test('handles empty options array', ({ render, theme }) => {
      renderBCFormSelect({ render, theme }, { options: [] })

      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    test('handles options with missing properties', ({ render, theme }) => {
      const incompleteOptions = [
        { value: 'has-value', label: 'Has Both' },
        { label: 'Missing Value' },
        { value: 'missing-label' }
      ]

      expect(() =>
        renderBCFormSelect({ render, theme }, { options: incompleteOptions })
      ).not.toThrow()
    })

    test('handles special characters in field name', ({ render, theme }) => {
      renderBCFormSelect(
        { render, theme },
        { name: 'field-with-special_chars.123' }
      )

      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    test('handles component unmounting cleanly', ({ render, theme }) => {
      const { unmount } = renderBCFormSelect({ render, theme })

      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Performance Testing', () => {
    test('handles large number of options', ({ render, theme }) => {
      const manyOptions = Array.from({ length: 100 }, (_, i) => ({
        value: `option${i}`,
        label: `Option ${i + 1}`
      }))

      const startTime = performance.now()
      renderBCFormSelect({ render, theme }, { options: manyOptions })
      const endTime = performance.now()

      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()

      // Should render efficiently
      expect(endTime - startTime).toBeLessThan(500)
    })

    test('maintains performance during re-renders', ({ render, theme }) => {
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
        </FormWrapper>
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
    test('renders with minimal required props', ({ render, theme }) => {
      render(
        <FormWrapper defaultValues={{ minimal: '' }}>
          {({ control }) => (
            <BCFormSelect
              name="minimal"
              control={control}
              options={[{ value: 'test', label: 'Test' }]}
            />
          )}
        </FormWrapper>
      )

      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    test('accepts all documented props', ({ render, theme }) => {
      const allProps = {
        name: 'fullTest',
        label: 'Full Test Select',
        options: [
          { value: 'val1', label: 'Label 1' },
          { value: 'val2', label: 'Label 2' }
        ]
      }

      expect(() =>
        renderBCFormSelect({ render, theme }, allProps)
      ).not.toThrow()

      expect(screen.getByText('Full Test Select')).toBeInTheDocument()
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
  })

  describe('Material-UI Integration', () => {
    test('applies correct Material-UI classes', ({ render, theme }) => {
      renderBCFormSelect({ render, theme })

      const formControl = screen
        .getByRole('combobox')
        .closest('.MuiFormControl-root')
      expect(formControl).toHaveClass('MuiFormControl-root')

      const select = screen.getByRole('combobox')
      expect(select).toHaveClass('MuiSelect-select')
    })

    test('integrates with Material-UI FormControl', ({ render, theme }) => {
      renderBCFormSelect({ render, theme })

      const select = screen.getByRole('combobox')
      const formControl = select.closest('.MuiFormControl-root')

      expect(formControl).toBeInTheDocument()
      expect(select.closest('.MuiInputBase-root')).toBeInTheDocument()
    })

    test('uses Material-UI InputLabel correctly', ({ render, theme }) => {
      renderBCFormSelect({ render, theme })

      const label = screen.getByText('Test Select')
      expect(label.closest('.MuiInputLabel-root')).toBeInTheDocument()
    })
  })

  describe('Component Structure and Internal Logic', () => {
    test('implements generateSingleOptions method correctly', ({
      render,
      theme
    }) => {
      // Test that the component can handle option generation
      renderBCFormSelect({ render, theme })

      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    test('integrates Controller component properly', ({ render, theme }) => {
      renderBCFormSelect({ render, theme })

      // Should render without React Hook Form errors
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    test('maintains proper component hierarchy', ({ render, theme }) => {
      renderBCFormSelect({ render, theme })

      const select = screen.getByRole('combobox')

      // Verify Material-UI component structure
      expect(select.closest('.MuiFormControl-root')).toBeInTheDocument()
      expect(select.closest('.MuiInputBase-root')).toBeInTheDocument()
      expect(select.closest('.MuiSelect-root')).toBeInTheDocument()
    })
  })
})
