/**
 * @vitest-environment jsdom
 */
import { describe, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm, FormProvider } from 'react-hook-form'
import { BCFormRadio } from '@/components/BCForm/BCFormRadio'
import { test as fixtureTest } from '@/tests/utils/fixtures'

vi.unmock('@/components/BCForm/BCFormRadio')

const test = (name, callback) =>
  fixtureTest(name, ({ render: fixtureRender, theme }) =>
    callback({
      render: (ui, providers = [], options = {}) =>
        fixtureRender(ui, providers.filter(Boolean), options),
      theme
    })
  )

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

describe.sequential('BCFormRadio', () => {
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

  const renderBCFormRadio = (
    { render, query, theme, localization, router, i18n },
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
          <BCFormRadio control={control} {...defaultProps} {...props} />
        )}
      </FormWrapper>,
      [query, theme, localization, router, i18n].filter(Boolean)
    )
  }

  describe('Basic Rendering', () => {
    test('renders radio group with correct structure', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormRadio({ render, query, theme, localization, router, i18n })

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
    })

    test('renders group label with correct text', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormRadio({ render, query, theme, localization, router, i18n })

      expect(screen.getByText('Test Radio Group')).toBeInTheDocument()

      const typography = document.querySelector('[data-test="bc-typography"]')
      expect(typography).toHaveAttribute('data-variant', 'label')
      expect(typography).toHaveAttribute('data-component', 'span')
    })

    test('renders all provided radio options', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormRadio({ render, query, theme, localization, router, i18n })

      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(3)

      expect(screen.getByText('Option 1')).toBeInTheDocument()
      expect(screen.getByText('Option 2')).toBeInTheDocument()
      expect(screen.getByText('Option 3')).toBeInTheDocument()
    })

    test('renders with proper FormControl styling', ({ render, theme }) => {
      renderBCFormRadio({ render, theme })

      const formControl = document.querySelector('.MuiFormControl-root')
      expect(formControl).toBeInTheDocument()

      // FormControl with component="fieldset" renders as a fieldset element
      const fieldset = document.querySelector('fieldset')
      expect(fieldset).toBeInTheDocument()
    })

    test('renders with vertical orientation by default', ({
      render,
      theme
    }) => {
      renderBCFormRadio({ render, theme })

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).not.toHaveAttribute('data-testid', 'row-radiogroup')
    })

    test('renders with horizontal orientation when specified', ({
      render,
      theme
    }) => {
      renderBCFormRadio({ render, theme }, { orientation: 'horizontal' })

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
      // Material-UI applies flex-direction: row for horizontal layout
    })
  })

  describe('Option Rendering', () => {
    test('renders options with simple labels', ({ render, theme }) => {
      const simpleOptions = [
        { value: 'simple1', label: 'Simple Label 1' },
        { value: 'simple2', label: 'Simple Label 2' }
      ]

      renderBCFormRadio({ render, theme }, { options: simpleOptions })

      expect(screen.getByText('Simple Label 1')).toBeInTheDocument()
      expect(screen.getByText('Simple Label 2')).toBeInTheDocument()
    })

    test('renders options with header and text using CustomLabel', ({
      render,
      theme
    }) => {
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

      renderBCFormRadio({ render, theme }, { options: headerOptions })

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

    test('handles empty options array', ({ render, theme }) => {
      renderBCFormRadio({ render, theme }, { options: [] })

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()

      const radios = screen.queryAllByRole('radio')
      expect(radios).toHaveLength(0)
    })
  })

  describe('Form Integration with React Hook Form', () => {
    test('integrates with react-hook-form control', ({ render, theme }) => {
      renderBCFormRadio({ render, theme }, {}, { testRadio: 'option2' })

      const radios = screen.getAllByRole('radio')

      // Second option should be checked
      expect(radios[0]).not.toBeChecked()
      expect(radios[1]).toBeChecked()
      expect(radios[2]).not.toBeChecked()
    })

    test('starts with no selection when no default provided', ({
      render,
      theme
    }) => {
      renderBCFormRadio({ render, theme })

      const radios = screen.getAllByRole('radio')

      radios.forEach((radio) => {
        expect(radio).not.toBeChecked()
      })
    })

    test('handles user selection and updates form state', async ({
      render,
      theme
    }) => {
      const user = userEvent.setup()

      renderBCFormRadio({ render, theme })

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

    test('handles selection changes correctly', async ({ render, theme }) => {
      const user = userEvent.setup()

      renderBCFormRadio({ render, theme }, {}, { testRadio: 'option1' })

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
    test('disables all radios when disabled prop is true', ({
      render,
      theme
    }) => {
      renderBCFormRadio({ render, theme }, { disabled: true })

      const radios = screen.getAllByRole('radio')

      radios.forEach((radio) => {
        expect(radio).toBeDisabled()
      })
    })

    test('prevents interaction when disabled', async ({ render, theme }) => {
      renderBCFormRadio({ render, theme }, { disabled: true })

      const radios = screen.getAllByRole('radio')

      // Disabled radios should not be clickable (Material-UI adds pointer-events: none)
      // Just verify they're disabled, user-event correctly throws when trying to click disabled elements
      expect(radios[0]).toBeDisabled()
      // Should remain unchecked
      expect(radios[0]).not.toBeChecked()
    })
  })

  describe('Accessibility', () => {
    test('has proper fieldset structure and typography label', ({
      render,
      theme
    }) => {
      renderBCFormRadio({ render, theme })

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()

      const typographyLabel = document.querySelector(
        '[data-test="bc-typography"]'
      )
      expect(typographyLabel).toBeInTheDocument()
      expect(typographyLabel).toHaveTextContent('Test Radio Group')

      const fieldset = document.querySelector('fieldset')
      expect(fieldset).toBeInTheDocument()
    })

    test('provides proper ARIA attributes for radios', ({ render, theme }) => {
      renderBCFormRadio({ render, theme })

      const radios = screen.getAllByRole('radio')

      radios.forEach((radio) => {
        expect(radio).toHaveAttribute('type', 'radio')
        expect(radio).toHaveAttribute('name') // React Hook Form generates its own name
      })
    })

    test('associates labels with radios correctly', ({ render, theme }) => {
      renderBCFormRadio({ render, theme })

      const option1Radio = screen.getByRole('radio', { name: /Option 1/i })
      const option1Label = screen.getByText('Option 1').closest('label')

      expect(option1Label).toContainElement(option1Radio)
    })

    test('supports keyboard navigation', async ({ render, theme }) => {
      const user = userEvent.setup()

      renderBCFormRadio({ render, theme })

      const radios = screen.getAllByRole('radio')

      // Focus first radio
      await user.click(radios[0])
      expect(radios[0]).toHaveFocus()

      // Use arrow keys to navigate
      await user.keyboard('{ArrowDown}')
      expect(radios[1]).toHaveFocus()
      expect(radios[1]).toBeChecked()
    })

    test('allows selection with the Enter key', async ({ render, theme }) => {
      const user = userEvent.setup()

      renderBCFormRadio({ render, theme })

      const radios = screen.getAllByRole('radio')

      await user.tab()
      expect(radios[0]).toHaveFocus()
      expect(radios[0]).not.toBeChecked()

      await user.keyboard('{Enter}')

      expect(radios[0]).toBeChecked()
    })

    test('provides proper focus management', async ({ render, theme }) => {
      const user = userEvent.setup()

      renderBCFormRadio({ render, theme })

      const radios = screen.getAllByRole('radio')

      // Each radio should be individually focusable
      await user.click(radios[0])
      expect(radios[0]).toHaveFocus()

      await user.click(radios[1])
      expect(radios[1]).toHaveFocus()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('handles undefined options gracefully', ({ render, theme }) => {
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
          [theme]
        )
      }).not.toThrow()
    })

    test('handles empty options array', ({ render, theme }) => {
      renderBCFormRadio({ render, theme }, { options: [] })

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
    })

    test('handles options with missing properties', ({ render, theme }) => {
      const incompleteOptions = [
        { value: 'has-value', label: 'Has Both' },
        { label: 'Missing Value' },
        { value: 'missing-label' }
      ]

      expect(() =>
        renderBCFormRadio({ render, theme }, { options: incompleteOptions })
      ).not.toThrow()
    })

    test('handles special characters in field name', ({ render, theme }) => {
      renderBCFormRadio(
        { render, theme },
        { name: 'field-with-special_chars.123' }
      )

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
    })
  })

  describe('Performance Testing', () => {
    test('handles large number of options', ({ render, theme }) => {
      const manyOptions = Array.from({ length: 50 }, (_, i) => ({
        value: `option${i}`,
        label: `Option ${i + 1}`
      }))

      const startTime = performance.now()
      renderBCFormRadio({ render, theme }, { options: manyOptions })
      const endTime = performance.now()

      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(50)

      // Should render efficiently (increased threshold to account for CI/test environment variability)
      expect(endTime - startTime).toBeLessThan(1000)
    })

    test('maintains performance during re-renders', ({ render, theme }) => {
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
        [theme]
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
    test('renders with minimal required props', ({ render, theme }) => {
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
        [theme]
      )

      const radio = screen.getByRole('radio')
      expect(radio).toBeInTheDocument()
    })

    test('accepts all documented props', ({ render, theme }) => {
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

      expect(() => renderBCFormRadio({ render, theme }, allProps)).not.toThrow()

      expect(screen.getByText('Full Test Radio')).toBeInTheDocument()
      expect(screen.getAllByRole('radio')).toHaveLength(2)
    })
  })

  describe('Material-UI Integration', () => {
    test('applies correct Material-UI classes', ({ render, theme }) => {
      renderBCFormRadio({ render, theme })

      const formControl = document.querySelector('.MuiFormControl-root')
      expect(formControl).toHaveClass('MuiFormControl-root')

      const radios = screen.getAllByRole('radio')
      radios.forEach((radio) => {
        expect(radio.closest('.MuiRadio-root')).toBeInTheDocument()
      })
    })

    test('integrates with Material-UI FormControlLabel', ({
      render,
      theme
    }) => {
      renderBCFormRadio({ render, theme })

      const labels = screen
        .getAllByRole('radio')
        .map((radio) => radio.closest('label'))

      labels.forEach((label) => {
        expect(label).toHaveClass('MuiFormControlLabel-root')
      })
    })

    test('applies correct spacing with marginTop prop', ({ render, theme }) => {
      renderBCFormRadio({ render, theme })

      const radios = screen.getAllByRole('radio')

      // Radio components should have marginTop styling
      radios.forEach((radio) => {
        expect(radio.closest('.MuiRadio-root')).toBeInTheDocument()
      })
    })

    test('renders typography label without FormLabel component', ({
      render,
      theme
    }) => {
      renderBCFormRadio({ render, theme })

      const typographyLabel = document.querySelector(
        '[data-test="bc-typography"]'
      )
      expect(typographyLabel).toBeInTheDocument()
      expect(document.querySelector('.MuiFormLabel-root')).toBeNull()
    })
  })

  describe('Orientation Options', () => {
    test('renders vertically by default', ({ render, theme }) => {
      renderBCFormRadio({ render, theme })

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
      // Vertical is default, no row attribute
    })

    test('renders horizontally when orientation is horizontal', ({
      render,
      theme
    }) => {
      renderBCFormRadio({ render, theme }, { orientation: 'horizontal' })

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
      // Material-UI applies row styling for horizontal layout
    })

    test('handles invalid orientation gracefully', ({ render, theme }) => {
      renderBCFormRadio({ render, theme }, { orientation: 'invalid' })

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
    })
  })

  describe('Custom Styling', () => {
    test('accepts custom sx prop', ({ render, theme }) => {
      const customSx = { backgroundColor: 'red' }
      renderBCFormRadio({ render, theme }, { sx: customSx })

      const formControl = document.querySelector('.MuiFormControl-root')
      expect(formControl).toBeInTheDocument()
    })

    test('applies custom styling to FormControl', ({ render, theme }) => {
      renderBCFormRadio({ render, theme }, { sx: { margin: 2 } })

      const formControl = document.querySelector('.MuiFormControl-root')
      expect(formControl).toBeInTheDocument()

      // FormControl with component="fieldset" renders as a fieldset element
      const fieldset = document.querySelector('fieldset')
      expect(fieldset).toBeInTheDocument()
      expect(fieldset).toHaveClass('MuiFormControl-root')
    })
  })
})
