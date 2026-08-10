import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { FormProvider, useForm } from 'react-hook-form'
import { AgreementDate } from '../AgreementDate'
import { test } from '@/tests/utils/fixtures'
import { describe, expect, vi, beforeEach } from 'vitest'
import * as formatters from '@/utils/formatters'
import { useTranslation } from 'react-i18next'

// Mock the dateFormatter utility
vi.mock('@/utils/formatters', () => ({
  dateFormatter: vi.fn()
}))

// Mock the translation hook
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn()
}))

const MockFormProvider = ({ children, defaultValues = {}, errors = {} }) => {
  const methods = useForm({ defaultValues })

  React.useEffect(() => {
    Object.entries(errors).forEach(([fieldName, error]) => {
      methods.setError(fieldName, error)
    })
  }, [errors, methods])

  return <FormProvider {...methods}>{children}</FormProvider>
}

describe('AgreementDate Component', () => {
  const mockT = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup translation mock
    mockT.mockImplementation((key) => {
      const translations = {
        'transfer:agrDateLabel': 'Agreement Date (required)',
        'transfer:agrDateDescText':
          'Date on which the written agreement for the transfer was reached between the organizations:',
        'transfer:agrDateHeader': 'Agreement Date:'
      }
      return translations[key] || key
    })

    useTranslation.mockReturnValue({ t: mockT })

    // Setup dateFormatter mock to return current date in YYYY-MM-DD format
    const currentDate = new Date()
    const expectedMaxDate = currentDate.toISOString().split('T')[0]
    formatters.dateFormatter.mockReturnValue(expectedMaxDate)
  })

  describe('Rendering', () => {
    test('renders correctly with label and description', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )
      expect(screen.getByText('Agreement Date (required)')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Date on which the written agreement for the transfer was reached between the organizations:'
        )
      ).toBeInTheDocument()
    })

    test('renders the date input with correct attributes', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput).toBeInTheDocument()
      expect(dateInput).toHaveAttribute('type', 'date')
      expect(dateInput).toHaveAttribute('placeholder', 'yyyy-mm-dd')
    })

    test('renders the agreement date header text', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )
      expect(screen.getByText('Agreement Date:')).toBeInTheDocument()
    })

    test('calls translation function with correct keys', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      expect(mockT).toHaveBeenCalledWith('transfer:agrDateLabel')
      expect(mockT).toHaveBeenCalledWith('transfer:agrDateDescText')
      expect(mockT).toHaveBeenCalledWith('transfer:agrDateHeader')
    })

    test('renders with correct data-test attributes', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      expect(screen.getByTestId('agreement-date')).toBeInTheDocument()
      expect(screen.getByTestId('transfer-agreement-date')).toBeInTheDocument()
      expect(
        screen.getByTestId('transfer-agreement-date-input')
      ).toBeInTheDocument()
    })

    test('sets max date correctly using dateFormatter', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const expectedMaxDate = '2024-01-15'
      formatters.dateFormatter.mockReturnValue(expectedMaxDate)

      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput).toHaveAttribute('max', expectedMaxDate)
      expect(formatters.dateFormatter).toHaveBeenCalledWith(expect.any(Date))
    })

    test('calls dateFormatter with current date', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      expect(formatters.dateFormatter).toHaveBeenCalled()
    })

    test('renders input with small size', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      const textField = screen.getByTestId('transfer-agreement-date')
      expect(textField).toHaveClass('MuiTextField-root')
    })

    test('displays error message when agreementDate has errors', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const errorMessage = 'Agreement date is required'
      render(
        <MockFormProvider
          errors={{
            agreementDate: { type: 'required', message: errorMessage }
          }}
        >
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      // Wait for the error message to appear
      expect(await screen.findByText(errorMessage)).toBeInTheDocument()
      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput.parentElement).toHaveClass('Mui-error')
    })

    test('does not display error when no errors exist', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput.parentElement).not.toHaveClass('Mui-error')
    })

    test('handles error object without message property', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider errors={{ agreementDate: { type: 'required' } }}>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput.parentElement).toHaveClass('Mui-error')
      // Should not crash when message property is undefined
    })
  })

  describe('Functionality', () => {
    test('renders input with correct name attribute', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput).toHaveAttribute('name', 'agreementDate')
    })

    test('updates the form value when date is changed', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      fireEvent.change(dateInput, { target: { value: '2023-01-01' } })

      expect(dateInput.value).toBe('2023-01-01')
    })
  })

  describe('Hook Integration', () => {
    test('calls useTranslation with transfer namespace', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      expect(useTranslation).toHaveBeenCalledWith(['transfer'])
    })
  })

  describe('Error State Branches', () => {
    test('handles !!errors.agreementDate branch when error exists', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider
          errors={{ agreementDate: { type: 'required', message: 'Error' } }}
        >
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput.parentElement).toHaveClass('Mui-error')
    })

    test('handles !!errors.agreementDate branch when no error exists', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput.parentElement).not.toHaveClass('Mui-error')
    })

    test('handles errors.agreementDate?.message optional chaining when error has message', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const errorMessage = 'Test error message'
      render(
        <MockFormProvider
          errors={{
            agreementDate: { type: 'required', message: errorMessage }
          }}
        >
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    test('handles errors.agreementDate?.message optional chaining when error has no message', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider errors={{ agreementDate: { type: 'required' } }}>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      // Should not crash and should not display any error text
      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput.parentElement).toHaveClass('Mui-error')
    })
  })

  describe('Component Structure and Props', () => {
    test('renders LabelBox with correct props', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      const labelBox = screen.getByTestId('agreement-date')
      expect(labelBox).toBeInTheDocument()
    })

    test('renders TextField with all required props', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput).toHaveAttribute('type', 'date')
      expect(dateInput).toHaveAttribute('placeholder', 'yyyy-mm-dd')
      expect(dateInput).toHaveAttribute(
        'data-test',
        'transfer-agreement-date-input'
      )
    })

    test('renders Box component with correct styling props', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      // The Box should contain the typography and text field
      expect(screen.getByText('Agreement Date:')).toBeInTheDocument()
      expect(screen.getByTestId('transfer-agreement-date')).toBeInTheDocument()
    })
  })

  describe('Date Processing Logic', () => {
    test('processes maxDate through dateFormatter correctly', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const testDate = '2024-12-31'
      formatters.dateFormatter.mockReturnValue(testDate)

      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput).toHaveAttribute('max', testDate)
      expect(formatters.dateFormatter).toHaveBeenCalled()
    })
  })

  describe('Form State Integration', () => {
    test('handles empty form state without errors', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      // Should render without crashing
      expect(screen.getByTestId('transfer-agreement-date')).toBeInTheDocument()
    })

    test('displays form state errors correctly', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const testError = 'Custom error message'
      render(
        <MockFormProvider errors={{ agreementDate: { message: testError } }}>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      expect(screen.getByText(testError)).toBeInTheDocument()
    })

    test('integrates with form context properly', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        [query, theme, localization, router]
      )

      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput).toHaveAttribute('name', 'agreementDate')
    })
  })
})
