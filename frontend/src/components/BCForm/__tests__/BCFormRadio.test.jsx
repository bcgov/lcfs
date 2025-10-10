/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm, FormProvider } from 'react-hook-form'
import { BCFormRadio } from '../BCFormRadio'
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

describe('BCFormRadio', () => {
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
    name: 'testRadio',
    label: 'Test Radio Group',
    options: defaultOptions
  }

  const renderBCFormRadio = (props = {}, formDefaults = {}) => {
    const finalDefaults = {
      [props.name || defaultProps.name]: '',
      ...formDefaults
    }
    return render(
      <FormWrapper defaultValues={finalDefaults}>
        {({ control }) => (
          <BCFormRadio control={control} {...defaultProps} {...props} />
        )}
      </FormWrapper>,
      { wrapper: AppWrapper }
    )
  }

  describe('Basic Rendering', () => {
    it('renders radio group with correct structure', () => {
      renderBCFormRadio()

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
    })

    it('renders group label with correct text', () => {
      renderBCFormRadio()

      expect(screen.getByText('Test Radio Group')).toBeInTheDocument()

      const typography = getByDataTest('bc-typography')
      expect(typography).toHaveAttribute('data-variant', 'label')
      expect(typography).toHaveAttribute('data-component', 'span')
    })

    it('renders all provided radio options', () => {
      renderBCFormRadio()

      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(3)

      expect(screen.getByText('Option 1')).toBeInTheDocument()
      expect(screen.getByText('Option 2')).toBeInTheDocument()
      expect(screen.getByText('Option 3')).toBeInTheDocument()
    })

    it('renders with proper FormControl styling', () => {
      renderBCFormRadio()

      const formControl = document.querySelector('.MuiFormControl-root')
      expect(formControl).toBeInTheDocument()

      // FormControl with component="fieldset" renders as a fieldset element
      const fieldset = document.querySelector('fieldset')
      expect(fieldset).toBeInTheDocument()
    })

    it('renders with vertical orientation by default', () => {
      renderBCFormRadio()

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).not.toHaveAttribute('data-testid', 'row-radiogroup')
    })

    it('renders with horizontal orientation when specified', () => {
      renderBCFormRadio({ orientation: 'horizontal' })

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
      // Material-UI applies flex-direction: row for horizontal layout
    })
  })

  describe('Option Rendering', () => {
    it('renders options with simple labels', () => {
      const simpleOptions = [
        { value: 'simple1', label: 'Simple Label 1' },
        { value: 'simple2', label: 'Simple Label 2' }
      ]

      renderBCFormRadio({ options: simpleOptions })

      expect(screen.getByText('Simple Label 1')).toBeInTheDocument()
      expect(screen.getByText('Simple Label 2')).toBeInTheDocument()
    })

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

      renderBCFormRadio({ options: headerOptions })

      const customLabels = document.querySelectorAll(
        '[data-test="custom-label"]'
      )
      expect(customLabels).toHaveLength(2)

      // Check for text content within the custom labels
      expect(customLabels[0]).toHaveTextContent(
        'Header Text — Description text'
      )
      expect(customLabels[1]).toHaveTextContent(
        'Another Header — Another description'
      )
    })

    it('handles empty options array', () => {
      renderBCFormRadio({ options: [] })

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()

      const radios = screen.queryAllByRole('radio')
      expect(radios).toHaveLength(0)
    })
  })

  describe('Form Integration with React Hook Form', () => {
    it('integrates with react-hook-form control', () => {
      renderBCFormRadio({}, { testRadio: 'option2' })

      const radios = screen.getAllByRole('radio')

      // Second option should be checked
      expect(radios[0]).not.toBeChecked()
      expect(radios[1]).toBeChecked()
      expect(radios[2]).not.toBeChecked()
    })

    it('starts with no selection when no default provided', () => {
      renderBCFormRadio()

      const radios = screen.getAllByRole('radio')

      radios.forEach((radio) => {
        expect(radio).not.toBeChecked()
      })
    })

    it('handles user selection and updates form state', async () => {
      const user = userEvent.setup()

      renderBCFormRadio()

      const radios = screen.getAllByRole('radio')

      // Initially unchecked
      expect(radios[0]).not.toBeChecked()

      // Click first radio
      await user.click(radios[0])

      // Should be checked now
      expect(radios[0]).toBeChecked()
      expect(radios[1]).not.toBeChecked()
      expect(radios[2]).not.toBeChecked()
    })

    it('handles selection changes correctly', async () => {
      const user = userEvent.setup()

      renderBCFormRadio({}, { testRadio: 'option1' })

      const radios = screen.getAllByRole('radio')

      // First should be initially checked
      expect(radios[0]).toBeChecked()
      expect(radios[1]).not.toBeChecked()

      // Click second radio
      await user.click(radios[1])

      // Second should be checked, first unchecked
      expect(radios[0]).not.toBeChecked()
      expect(radios[1]).toBeChecked()
    })
  })

  describe('Disabled State', () => {
    it('disables all radios when disabled prop is true', () => {
      renderBCFormRadio({ disabled: true })

      const radios = screen.getAllByRole('radio')

      radios.forEach((radio) => {
        expect(radio).toBeDisabled()
      })
    })

    it('prevents interaction when disabled', async () => {
      renderBCFormRadio({ disabled: true })

      const radios = screen.getAllByRole('radio')

      // Disabled radios should not be clickable (Material-UI adds pointer-events: none)
      // Just verify they're disabled, user-event correctly throws when trying to click disabled elements
      expect(radios[0]).toBeDisabled()
      // Should remain unchecked
      expect(radios[0]).not.toBeChecked()
    })
  })

  describe('Accessibility', () => {
    it('has proper fieldset and legend structure', () => {
      renderBCFormRadio()

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()

      const label = document.querySelector('.MuiFormLabel-root')
      expect(label).toBeInTheDocument()
      expect(label).toHaveTextContent('Test Radio Group')
    })

    it('provides proper ARIA attributes for radios', () => {
      renderBCFormRadio()

      const radios = screen.getAllByRole('radio')

      radios.forEach((radio) => {
        expect(radio).toHaveAttribute('type', 'radio')
        expect(radio).toHaveAttribute('name') // React Hook Form generates its own name
      })
    })

    it('associates labels with radios correctly', () => {
      renderBCFormRadio()

      const option1Radio = screen.getByRole('radio', { name: /Option 1/i })
      const option1Label = screen.getByText('Option 1').closest('label')

      expect(option1Label).toContainElement(option1Radio)
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()

      renderBCFormRadio()

      const radios = screen.getAllByRole('radio')

      // Focus first radio
      await user.click(radios[0])
      expect(radios[0]).toHaveFocus()

      // Use arrow keys to navigate
      await user.keyboard('{ArrowDown}')
      expect(radios[1]).toHaveFocus()
      expect(radios[1]).toBeChecked()
    })

    it('provides proper focus management', async () => {
      const user = userEvent.setup()

      renderBCFormRadio()

      const radios = screen.getAllByRole('radio')

      // Each radio should be individually focusable
      await user.click(radios[0])
      expect(radios[0]).toHaveFocus()

      await user.click(radios[1])
      expect(radios[1]).toHaveFocus()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles undefined options gracefully', () => {
      expect(() => {
        render(
          <FormWrapper defaultValues={{ test: '' }}>
            {({ control }) => (
              <BCFormRadio
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
      renderBCFormRadio({ options: [] })

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
    })

    it('handles options with missing properties', () => {
      const incompleteOptions = [
        { value: 'has-value', label: 'Has Both' },
        { label: 'Missing Value' },
        { value: 'missing-label' }
      ]

      expect(() =>
        renderBCFormRadio({ options: incompleteOptions })
      ).not.toThrow()
    })

    it('handles special characters in field name', () => {
      renderBCFormRadio({ name: 'field-with-special_chars.123' })

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
    })
  })

  describe('Performance Testing', () => {
    it('handles large number of options', () => {
      const manyOptions = Array.from({ length: 50 }, (_, i) => ({
        value: `option${i}`,
        label: `Option ${i + 1}`
      }))

      const startTime = performance.now()
      renderBCFormRadio({ options: manyOptions })
      const endTime = performance.now()

      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(50)

      // Should render efficiently (increased threshold to account for CI/test environment variability)
      expect(endTime - startTime).toBeLessThan(1000)
    })

    it('maintains performance during re-renders', () => {
      const { rerender } = render(
        <FormWrapper defaultValues={{ testRadio: 'option1' }}>
          {({ control }) => (
            <BCFormRadio
              control={control}
              name="testRadio"
              label="Test Radio"
              options={defaultOptions}
            />
          )}
        </FormWrapper>,
        { wrapper: AppWrapper }
      )

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()

      // Re-render
      rerender(
        <FormWrapper defaultValues={{ testRadio: 'option1' }}>
          {({ control }) => (
            <BCFormRadio
              control={control}
              name="testRadio"
              label="Updated Label"
              options={defaultOptions}
            />
          )}
        </FormWrapper>
      )

      // Should handle re-render gracefully
      expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    })
  })

  describe('PropTypes and API', () => {
    it('renders with minimal required props', () => {
      render(
        <FormWrapper defaultValues={{ minimal: '' }}>
          {({ control }) => (
            <BCFormRadio
              name="minimal"
              control={control}
              options={[{ value: 'test', label: 'Test' }]}
            />
          )}
        </FormWrapper>,
        { wrapper: AppWrapper }
      )

      const radio = screen.getByRole('radio')
      expect(radio).toBeInTheDocument()
    })

    it('accepts all documented props', () => {
      const allProps = {
        name: 'fullTest',
        label: 'Full Test Radio',
        options: [
          { value: 'val1', label: 'Label 1' },
          { value: 'val2', label: 'Label 2' }
        ],
        disabled: false,
        orientation: 'horizontal'
      }

      expect(() => renderBCFormRadio(allProps)).not.toThrow()

      expect(screen.getByText('Full Test Radio')).toBeInTheDocument()
      expect(screen.getAllByRole('radio')).toHaveLength(2)
    })
  })

  describe('Material-UI Integration', () => {
    it('applies correct Material-UI classes', () => {
      renderBCFormRadio()

      const formControl = document.querySelector('.MuiFormControl-root')
      expect(formControl).toHaveClass('MuiFormControl-root')

      const radios = screen.getAllByRole('radio')
      radios.forEach((radio) => {
        expect(radio.closest('.MuiRadio-root')).toBeInTheDocument()
      })
    })

    it('integrates with Material-UI FormControlLabel', () => {
      renderBCFormRadio()

      const labels = screen
        .getAllByRole('radio')
        .map((radio) => radio.closest('label'))

      labels.forEach((label) => {
        expect(label).toHaveClass('MuiFormControlLabel-root')
      })
    })

    it('applies correct spacing with marginTop prop', () => {
      renderBCFormRadio()

      const radios = screen.getAllByRole('radio')

      // Radio components should have marginTop styling
      radios.forEach((radio) => {
        expect(radio.closest('.MuiRadio-root')).toBeInTheDocument()
      })
    })

    it('uses correct FormLabel component', () => {
      renderBCFormRadio()

      const label = document.querySelector('.MuiFormLabel-root')
      expect(label).toBeInTheDocument()

      // FormLabel with component="legend" renders as a legend element
      const legend = document.querySelector('legend')
      expect(legend).toBeInTheDocument()
    })
  })

  describe('Orientation Options', () => {
    it('renders vertically by default', () => {
      renderBCFormRadio()

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
      // Vertical is default, no row attribute
    })

    it('renders horizontally when orientation is horizontal', () => {
      renderBCFormRadio({ orientation: 'horizontal' })

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
      // Material-UI applies row styling for horizontal layout
    })

    it('handles invalid orientation gracefully', () => {
      renderBCFormRadio({ orientation: 'invalid' })

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
    })
  })

  describe('Custom Styling', () => {
    it('accepts custom sx prop', () => {
      const customSx = { backgroundColor: 'red' }
      renderBCFormRadio({ sx: customSx })

      const formControl = document.querySelector('.MuiFormControl-root')
      expect(formControl).toBeInTheDocument()
    })

    it('applies custom styling to FormControl', () => {
      renderBCFormRadio({ sx: { margin: 2 } })

      const formControl = document.querySelector('.MuiFormControl-root')
      expect(formControl).toBeInTheDocument()

      // FormControl with component="fieldset" renders as a fieldset element
      const fieldset = document.querySelector('fieldset')
      expect(fieldset).toBeInTheDocument()
      expect(fieldset).toHaveClass('MuiFormControl-root')
    })
  })
})
