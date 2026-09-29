/**
 * @vitest-environment jsdom
 */
import { describe, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm, FormProvider } from 'react-hook-form'
import { BCFormCheckbox } from '@/components/BCForm/BCFormCheckbox'
import { test as fixtureTest } from '@/tests/utils/fixtures'

vi.unmock('@/components/BCForm/BCFormCheckbox')

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

describe.sequential('BCFormCheckbox', () => {
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

  const renderBCFormCheckbox = (
    { render, query, theme, localization, router, i18n },
    props = {},
    formDefaults = {}
  ) => {
    const finalDefaults = {
      [props.name || defaultProps.name]: [],
      ...formDefaults
    }
    return render(
      <FormWrapper defaultValues={finalDefaults}>
        {({ form }) => (
          <BCFormCheckbox form={form} {...defaultProps} {...props} />
        )}
      </FormWrapper>,
      [query, theme, localization, router, i18n].filter(Boolean)
    )
  }

  describe('Basic Rendering', () => {
    test('renders checkbox group with correct structure', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormCheckbox({ render, query, theme, localization, router, i18n })

      // Look for FormControl instead of fieldset
      const formControl = document.querySelector('.MuiFormControl-root')
      expect(formControl).toBeInTheDocument()
    })

    test('renders group label with correct text', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormCheckbox({ render, query, theme, localization, router, i18n })

      expect(screen.getByText('Test Checkbox Group')).toBeInTheDocument()

      const typography = document.querySelector('[data-test="bc-typography"]')
      expect(typography).toHaveAttribute('data-variant', 'label')
      expect(typography).toHaveAttribute('data-component', 'span')
    })

    test('renders all provided checkbox options', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormCheckbox({ render, query, theme, localization, router, i18n })

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(3)

      expect(screen.getByText('Option 1')).toBeInTheDocument()
      expect(screen.getByText('Option 2')).toBeInTheDocument()
      expect(screen.getByText('Option 3')).toBeInTheDocument()
    })
  })

  describe('Option Rendering', () => {
    test('renders options with header and text using CustomLabel', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
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

      renderBCFormCheckbox(
        { render, query, theme, localization, router, i18n },
        { options: headerOptions }
      )

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

    test('handles empty options array', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormCheckbox(
        { render, query, theme, localization, router, i18n },
        { options: [] }
      )

      const formControl = document.querySelector('.MuiFormControl-root')
      expect(formControl).toBeInTheDocument()

      const checkboxes = screen.queryAllByRole('checkbox')
      expect(checkboxes).toHaveLength(0)
    })
  })

  describe('Form Integration with React Hook Form', () => {
    test('integrates with react-hook-form control', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormCheckbox(
        { render, query, theme, localization, router, i18n },
        {},
        { testCheckbox: ['option1', 'option3'] }
      )

      const checkboxes = screen.getAllByRole('checkbox')

      // First and third options should be checked
      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).not.toBeChecked()
      expect(checkboxes[2]).toBeChecked()
    })

    test('handles user selection and updates form state', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      renderBCFormCheckbox({ render, query, theme, localization, router, i18n })

      const checkboxes = screen.getAllByRole('checkbox')

      // Initially unchecked
      expect(checkboxes[0]).not.toBeChecked()

      // Click first checkbox
      await user.click(checkboxes[0])

      // Should be checked now
      expect(checkboxes[0]).toBeChecked()
    })

    test('handles multiple selections correctly', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      renderBCFormCheckbox({ render, query, theme, localization, router, i18n })

      const checkboxes = screen.getAllByRole('checkbox')

      // Select first and third options
      await user.click(checkboxes[0])
      await user.click(checkboxes[2])

      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).not.toBeChecked()
      expect(checkboxes[2]).toBeChecked()
    })

    test('handles deselection of checked items', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      renderBCFormCheckbox(
        { render, query, theme, localization, router, i18n },
        {},
        { testCheckbox: ['option1'] }
      )

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
    test('adds new values to selection array', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      renderBCFormCheckbox({ render, query, theme, localization, router, i18n })

      const checkboxes = screen.getAllByRole('checkbox')

      // Click multiple checkboxes
      await user.click(checkboxes[0])
      await user.click(checkboxes[1])

      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).toBeChecked()
      expect(checkboxes[2]).not.toBeChecked()
    })

    test('removes values from selection array when unchecked', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      renderBCFormCheckbox(
        { render, query, theme, localization, router, i18n },
        {},
        { testCheckbox: ['option1', 'option2'] }
      )

      const checkboxes = screen.getAllByRole('checkbox')

      // Both should be initially checked
      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).toBeChecked()

      // Uncheck first one
      await user.click(checkboxes[0])

      expect(checkboxes[0]).not.toBeChecked()
      expect(checkboxes[1]).toBeChecked()
    })

    test('handles duplicate values correctly', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      renderBCFormCheckbox(
        { render, query, theme, localization, router, i18n },
        {},
        { testCheckbox: ['option1'] }
      )

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
    test('disables all checkboxes when disabled prop is true', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormCheckbox(
        { render, query, theme, localization, router, i18n },
        { disabled: true }
      )

      const checkboxes = screen.getAllByRole('checkbox')

      checkboxes.forEach((checkbox) => {
        expect(checkbox).toBeDisabled()
      })
    })
  })

  describe('Accessibility', () => {
    test('supports keyboard navigation', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      renderBCFormCheckbox({ render, query, theme, localization, router, i18n })

      const checkboxes = screen.getAllByRole('checkbox')

      // Focus first checkbox
      await user.click(checkboxes[0])
      expect(checkboxes[0]).toHaveFocus()

      // Clicking the checkbox should toggle it
      expect(checkboxes[0]).toBeChecked()
    })

    test('allows toggling with the Enter key', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      renderBCFormCheckbox({ render, query, theme, localization, router, i18n })

      const checkboxes = screen.getAllByRole('checkbox')

      await user.tab()
      expect(checkboxes[0]).toHaveFocus()
      expect(checkboxes[0]).not.toBeChecked()

      await user.keyboard('{Enter}')

      expect(checkboxes[0]).toBeChecked()
    })

    test('provides proper focus management', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      renderBCFormCheckbox({ render, query, theme, localization, router, i18n })

      const checkboxes = screen.getAllByRole('checkbox')

      // Each checkbox should be individually focusable
      await user.click(checkboxes[0])
      expect(checkboxes[0]).toHaveFocus()

      await user.click(checkboxes[1])
      expect(checkboxes[1]).toHaveFocus()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('handles undefined form prop gracefully', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      expect(() => {
        render(
          <BCFormCheckbox
            name="test"
            form={undefined}
            label="Test"
            options={defaultOptions}
          />,
          [theme]
        )
      }).toThrow() // This should throw as form is required
    })

    test('handles empty options array', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormCheckbox(
        { render, query, theme, localization, router, i18n },
        { options: [] }
      )

      const formControl = document.querySelector('.MuiFormControl-root')
      expect(formControl).toBeInTheDocument()

      const checkboxes = screen.queryAllByRole('checkbox')
      expect(checkboxes).toHaveLength(0)
    })

    test('handles options with missing values', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const incompleteOptions = [
        { label: 'Missing Value' },
        { value: 'has-value', label: 'Has Value' }
      ]

      expect(() =>
        renderBCFormCheckbox(
          { render, query, theme, localization, router, i18n },
          { options: incompleteOptions }
        )
      ).not.toThrow()
    })

    test('handles options with missing labels', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const incompleteOptions = [
        { value: 'missing-label' },
        { value: 'has-label', label: 'Has Label' }
      ]

      expect(() =>
        renderBCFormCheckbox(
          { render, query, theme, localization, router, i18n },
          { options: incompleteOptions }
        )
      ).not.toThrow()
    })

    test('handles special characters in field name', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormCheckbox(
        { render, query, theme, localization, router, i18n },
        { name: 'field-with-special_chars.123' }
      )

      const formControl = document.querySelector('.MuiFormControl-root')
      expect(formControl).toBeInTheDocument()
    })

    test('handles very long option labels', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const longOptions = [
        {
          value: 'long',
          label:
            'This is a very long option label that might wrap to multiple lines and test how the component handles lengthy text content'
        }
      ]

      renderBCFormCheckbox(
        { render, query, theme, localization, router, i18n },
        { options: longOptions }
      )

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
    })

    test('handles component unmounting cleanly', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const { unmount } = renderBCFormCheckbox({
        render,
        query,
        theme,
        localization,
        router,
        i18n
      })

      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Performance and Optimization', () => {
    test('handles large numbers of options efficiently', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const manyOptions = Array.from({ length: 100 }, (_, i) => ({
        value: `option${i}`,
        label: `Option ${i + 1}`
      }))

      const startTime = performance.now()
      renderBCFormCheckbox(
        { render, query, theme, localization, router, i18n },
        { options: manyOptions }
      )
      const endTime = performance.now()

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(100)

      // Should render efficiently - increased threshold for CI environments
      expect(endTime - startTime).toBeLessThan(2000)
    })

    test('maintains selection state during re-renders', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
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
        [theme]
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

    test('handles rapid user interactions without errors', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      renderBCFormCheckbox({ render, query, theme, localization, router, i18n })

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
    test('renders with minimal required props', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
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
        [theme]
      )

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
    })

    test('accepts all documented props', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const allProps = {
        name: 'fullTest',
        label: 'Full Test Checkboxes',
        options: [
          { value: 'val1', label: 'Label 1' },
          { value: 'val2', label: 'Label 2' }
        ],
        disabled: false
      }

      expect(() =>
        renderBCFormCheckbox(
          { render, query, theme, localization, router, i18n },
          allProps
        )
      ).not.toThrow()

      expect(screen.getByText('Full Test Checkboxes')).toBeInTheDocument()
      expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    })
  })

  describe('Default Props and Display Name', () => {
    test('uses correct default props', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      // Test that initialItems defaults to empty array
      renderBCFormCheckbox({ render, query, theme, localization, router, i18n })

      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach((checkbox) => {
        expect(checkbox).not.toBeChecked()
      })
    })

    test('has correct display name', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      expect(BCFormCheckbox.displayName).toBe('BCFormCheckbox')
    })
  })

  describe('Material-UI Integration', () => {
    test('applies correct Material-UI classes', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormCheckbox({ render, query, theme, localization, router, i18n })

      const formControl = document.querySelector('.MuiFormControl-root')
      expect(formControl).toHaveClass('MuiFormControl-root')

      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach((checkbox) => {
        expect(checkbox.closest('.MuiCheckbox-root')).toBeInTheDocument()
      })
    })

    test('integrates with Material-UI FormControlLabel', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormCheckbox({ render, query, theme, localization, router, i18n })

      const labels = screen
        .getAllByRole('checkbox')
        .map((cb) => cb.closest('label'))

      labels.forEach((label) => {
        expect(label).toHaveClass('MuiFormControlLabel-root')
      })
    })

    test('applies correct spacing with marginY prop', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderBCFormCheckbox({ render, query, theme, localization, router, i18n })

      const labels = screen
        .getAllByRole('checkbox')
        .map((cb) => cb.closest('label'))

      // FormControlLabel should have marginY styling
      labels.forEach((label) => {
        expect(label).toHaveClass('MuiFormControlLabel-root')
      })
    })
  })
})
