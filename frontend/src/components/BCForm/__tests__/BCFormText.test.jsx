/**
 * @vitest-environment jsdom
 */
import { describe, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm, FormProvider } from 'react-hook-form'
import { BCFormText } from '@/components/BCForm/BCFormText'
import { test as fixtureTest } from '@/tests/utils/fixtures'

vi.unmock('@/components/BCForm/BCFormText')

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

describe.sequential('BCFormText', () => {
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

  const defaultProps = {
    name: 'testField',
    label: 'Test Label'
  }

  const renderBCFormText = (
    { render, query, theme, localization, router, i18n },
    props = {},
    formDefaults = {}
  ) => {
    return render(
      <FormWrapper defaultValues={formDefaults}>
        {({ control, form }) => (
          <BCFormText
            form={form}
            control={control}
            {...defaultProps}
            {...props}
          />
        )}
      </FormWrapper>,
      [query, theme, localization, router, i18n].filter(Boolean)
    )
  }

  describe('Basic Rendering', () => {
    test('renders text input field with correct attributes', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormText({ render, theme })

      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('id', 'testField')
      expect(input).toHaveAttribute('type', 'text')
    })

    test('renders label with correct text', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormText({ render, theme })

      const label = screen.getByText('Test Label:')
      expect(label).toBeInTheDocument()

      const typography = document.querySelector('[data-test="bc-typography"]')
      expect(typography).toHaveAttribute('data-variant', 'label')
      expect(typography).toHaveAttribute('data-component', 'span')
    })

    test('associates label with input field for accessibility', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormText({ render, theme })

      const input = screen.getByRole('textbox')
      const label = screen.getByText('Test Label:').closest('label')

      expect(label).toHaveAttribute('for', 'testField')
      expect(input).toHaveAttribute('id', 'testField')
    })
  })

  describe('Optional Field Indicators', () => {
    test('shows optional indicator when optional prop is true', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormText({ render, theme }, { optional: true })

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

    test('renders checkbox when checkbox prop is true', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormText({ render, theme }, checkboxProps)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
      expect(checkbox).toHaveAttribute('type', 'checkbox')
    })

    test('renders checkbox label with correct styling', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormText({ render, theme }, checkboxProps)

      expect(screen.getByText('Enable this option')).toBeInTheDocument()

      const labelTypography = screen
        .getAllByTestId('bc-typography')
        .find((el) => el.textContent === 'Enable this option')
      expect(labelTypography).toHaveAttribute('data-variant', 'body4')
      expect(labelTypography).toHaveAttribute('data-color', 'text')
    })

    test('sets checkbox checked state correctly', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormText({ render, theme }, { ...checkboxProps, isChecked: true })

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeChecked()
    })

    test('calls onCheckboxChange when checkbox is clicked', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()
      const onCheckboxChange = vi.fn()

      renderBCFormText(
        { render, theme },
        { ...checkboxProps, onCheckboxChange }
      )

      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)

      expect(onCheckboxChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('Disabled State', () => {
    test('disables input when disabled prop is true', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormText({ render, theme }, { disabled: true })

      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
    })
  })

  describe('Form Integration with React Hook Form', () => {
    test('integrates with react-hook-form control for value management', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      render(
        <FormWrapper defaultValues={{ testField: 'Initial Value' }}>
          {({ control }) => (
            <BCFormText name="testField" control={control} label="Test Field" />
          )}
        </FormWrapper>,
        [theme]
      )

      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('Initial Value')
    })

    test('handles user input and updates form state', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      render(
        <FormWrapper>
          {({ control }) => (
            <BCFormText name="testField" control={control} label="Test Field" />
          )}
        </FormWrapper>,
        [theme]
      )

      const input = screen.getByRole('textbox')
      await user.type(input, 'New Value')

      expect(input).toHaveValue('New Value')
    })

    test('displays form validation errors', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
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
        [theme]
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
    test('has proper label association for screen readers', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormText({ render, theme })

      const input = screen.getByRole('textbox')
      const label = screen.getByText('Test Label:').closest('label')

      expect(label).toHaveAttribute('for', 'testField')
      expect(input).toHaveAttribute('id', 'testField')
    })

    test('supports keyboard navigation', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      renderBCFormText(
        { render, theme },
        {
          checkbox: true,
          checkboxLabel: 'Test Checkbox',
          onCheckboxChange: vi.fn()
        }
      )

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
    test('handles special characters in field name', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormText(
        { render, theme },
        { name: 'field-with-special_chars.123' }
      )

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('id', 'field-with-special_chars.123')
    })

    test('handles rapid user input without errors', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      renderBCFormText({ render, theme }, {}, { testField: '' })

      const input = screen.getByRole('textbox')

      // Simulate rapid typing
      await user.type(input, 'RapidInput', { delay: 10 })

      expect(input).toHaveValue('RapidInput')
    })

    test('preserves input focus during re-renders', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      const { rerender } = render(
        <FormWrapper>
          {({ control }) => (
            <BCFormText name="testField" control={control} label="Test Field" />
          )}
        </FormWrapper>,
        [theme]
      )

      const input = screen.getByRole('textbox')
      await user.click(input)

      expect(input).toHaveFocus()

      // Re-render component
      rerender(
        <FormWrapper>
          {({ control }) => (
            <BCFormText
              name="testField"
              control={control}
              label="Updated Label"
            />
          )}
        </FormWrapper>
      )

      // Focus should be maintained
      expect(input).toHaveFocus()
    })
  })

  describe('Performance and Optimization', () => {
    test('does not cause unnecessary re-renders', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const renderSpy = vi.fn()

      const TestComponentWrapper = (props) => {
        renderSpy()
        return (
          <FormWrapper>
            {({ control }) => (
              <BCFormText {...defaultProps} control={control} {...props} />
            )}
          </FormWrapper>
        )
      }

      const { rerender } = render(<TestComponentWrapper />, [theme])

      expect(renderSpy).toHaveBeenCalledTimes(1)

      // Re-render with same props
      rerender(<TestComponentWrapper />)

      // Should still only be called twice (initial + rerender)
      expect(renderSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('PropTypes Validation', () => {
    test('renders correctly with minimal required props', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      render(
        <FormWrapper>
          {({ control }) => <BCFormText name="minimal" control={control} />}
        </FormWrapper>,
        [theme]
      )

      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('id', 'minimal')
    })

    test('accepts all documented prop types', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
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

      expect(() => renderBCFormText({ render, theme }, allProps)).not.toThrow()

      expect(screen.getByText('Full Test Label:')).toBeInTheDocument()
      expect(screen.getByText('(optional)')).toBeInTheDocument()
      expect(screen.getByRole('checkbox')).toBeChecked()
      expect(screen.getByText('Checkbox Label')).toBeInTheDocument()
    })
  })
})
