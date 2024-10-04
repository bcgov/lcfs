import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { FormProvider, useForm } from 'react-hook-form'
import { AgreementDate } from '../AgreementDate'
import { wrapper } from '@/tests/utils/wrapper'
import { describe, expect, it, vi } from 'vitest'

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

    it('sets max date correctly', () => {
      const currentDate = new Date()
      const maxDate = currentDate.toISOString().split('T')[0]

      render(
        <MockFormProvider>
          <AgreementDate />
        </MockFormProvider>,
        { wrapper }
      )
      const dateInput = screen.getByTestId('transfer-agreement-date-input')
      expect(dateInput).toHaveAttribute('max', maxDate)
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
})
