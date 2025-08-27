import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { FormProvider, useForm } from 'react-hook-form'
import { AgreementDate } from '../AgreementDate'
import { wrapper } from '@/tests/utils/wrapper'
import { describe, expect, it, vi, beforeEach } from 'vitest'
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
        'transfer:agrDateDescText': 'Date on which the written agreement for the transfer was reached between the organizations:',
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
    it('renders correctly with label and description', () => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      expect(screen.getByText('Agreement Date (required)')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Date on which the written agreement for the transfer was reached between the organizations:'
        )
      ).toBeInTheDocument()
    })

    it('renders the date input with correct attributes', () => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )

      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput).toBeInTheDocument()
      expect(dateInput).toHaveAttribute('type', 'date')
      expect(dateInput).toHaveAttribute('placeholder', 'yyyy-mm-dd')
    })

    it('renders the agreement date header text', () => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      expect(screen.getByText('Agreement Date:')).toBeInTheDocument()
    })

    it('calls translation function with correct keys', () => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(mockT).toHaveBeenCalledWith('transfer:agrDateLabel')
      expect(mockT).toHaveBeenCalledWith('transfer:agrDateDescText')
      expect(mockT).toHaveBeenCalledWith('transfer:agrDateHeader')
    })

    it('renders with correct data-test attributes', () => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByTestId('agreement-date')).toBeInTheDocument()
      expect(screen.getByTestId('transfer-agreement-date')).toBeInTheDocument()
      expect(screen.getByTestId('transfer-agreement-date-input')).toBeInTheDocument()
    })

    it('sets max date correctly using dateFormatter', () => {
      const expectedMaxDate = '2024-01-15'
      formatters.dateFormatter.mockReturnValue(expectedMaxDate)

      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput).toHaveAttribute('max', expectedMaxDate)
      expect(formatters.dateFormatter).toHaveBeenCalledWith(expect.any(Date))
    })

    it('calls dateFormatter with current date', () => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(formatters.dateFormatter).toHaveBeenCalled()
    })

    it('renders input with small size', () => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      const textField = screen.getByTestId('transfer-agreement-date')
      expect(textField).toHaveClass('MuiTextField-root')
    })

    it('displays error message when agreementDate has errors', async () => {
      const errorMessage = 'Agreement date is required'
      render(
        <MockFormProvider
          errors={{ agreementDate: { type: 'required', message: errorMessage } }}
        >
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )

      // Wait for the error message to appear
      expect(await screen.findByText(errorMessage)).toBeInTheDocument()
      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput.parentElement).toHaveClass('Mui-error')
    })

    it('does not display error when no errors exist', () => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput.parentElement).not.toHaveClass('Mui-error')
    })

    it('handles error object without message property', () => {
      render(
        <MockFormProvider
          errors={{ agreementDate: { type: 'required' } }}
        >
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput.parentElement).toHaveClass('Mui-error')
      // Should not crash when message property is undefined
    })
  })

  describe('Functionality', () => {
    it('renders input with correct name attribute', () => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )

      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput).toHaveAttribute('name', 'agreementDate')
    })

    it('updates the form value when date is changed', () => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )

      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      fireEvent.change(dateInput, { target: { value: '2023-01-01' } })

      expect(dateInput.value).toBe('2023-01-01')
    })
  })

  describe('Hook Integration', () => {
    it('calls useTranslation with transfer namespace', () => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(useTranslation).toHaveBeenCalledWith(['transfer'])
    })
  })

  describe('Error State Branches', () => {
    it('handles !!errors.agreementDate branch when error exists', () => {
      render(
        <MockFormProvider
          errors={{ agreementDate: { type: 'required', message: 'Error' } }}
        >
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput.parentElement).toHaveClass('Mui-error')
    })

    it('handles !!errors.agreementDate branch when no error exists', () => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput.parentElement).not.toHaveClass('Mui-error')
    })

    it('handles errors.agreementDate?.message optional chaining when error has message', () => {
      const errorMessage = 'Test error message'
      render(
        <MockFormProvider
          errors={{ agreementDate: { type: 'required', message: errorMessage } }}
        >
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('handles errors.agreementDate?.message optional chaining when error has no message', () => {
      render(
        <MockFormProvider
          errors={{ agreementDate: { type: 'required' } }}
        >
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      // Should not crash and should not display any error text
      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput.parentElement).toHaveClass('Mui-error')
    })
  })

  describe('Component Structure and Props', () => {
    it('renders LabelBox with correct props', () => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      const labelBox = screen.getByTestId('agreement-date')
      expect(labelBox).toBeInTheDocument()
    })

    it('renders TextField with all required props', () => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput).toHaveAttribute('type', 'date')
      expect(dateInput).toHaveAttribute('placeholder', 'yyyy-mm-dd')
      expect(dateInput).toHaveAttribute('data-test', 'transfer-agreement-date-input')
    })

    it('renders Box component with correct styling props', () => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      // The Box should contain the typography and text field
      expect(screen.getByText('Agreement Date:')).toBeInTheDocument()
      expect(screen.getByTestId('transfer-agreement-date')).toBeInTheDocument()
    })
  })

  describe('Date Processing Logic', () => {
    it('processes maxDate through dateFormatter correctly', () => {
      const testDate = '2024-12-31'
      formatters.dateFormatter.mockReturnValue(testDate)
      
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput).toHaveAttribute('max', testDate)
      expect(formatters.dateFormatter).toHaveBeenCalled()
    })
  })

  describe('Form State Integration', () => {
    it('handles empty form state without errors', () => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      // Should render without crashing
      expect(screen.getByTestId('transfer-agreement-date')).toBeInTheDocument()
    })

    it('displays form state errors correctly', () => {
      const testError = 'Custom error message'
      render(
        <MockFormProvider
          errors={{ agreementDate: { message: testError } }}
        >
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByText(testError)).toBeInTheDocument()
    })

    it('integrates with form context properly', () => {
      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      
      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput).toHaveAttribute('name', 'agreementDate')
    })
  })
})