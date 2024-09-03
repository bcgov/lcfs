import React from 'react'
import { render, screen } from '@testing-library/react'
import { FormProvider, useForm } from 'react-hook-form'
import { AgreementDate } from '../AgreementDate'
import { wrapper } from '@/tests/utils/wrapper.jsx'

const MockFormProvider = ({ children }) => {
  const methods = useForm()
  return <FormProvider {...methods}>{children}</FormProvider>
}

describe('AgreementDate', () => {
  test('renders correctly with label and description', () => {
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

  test('sets max date correctly', () => {
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
})
