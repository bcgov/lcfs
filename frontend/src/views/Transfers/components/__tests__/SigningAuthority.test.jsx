import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { SigningAuthority } from '../SigningAuthority'
import { FormProvider, useForm } from 'react-hook-form'
import { describe, expect, vi } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

const MockFormProvider = ({ children }) => {
  const methods = useForm()
  return <FormProvider {...methods}>{children}</FormProvider>
}

describe('SigningAuthority Component', () => {
  it('renders correctly with title', () => {
    render(
      <MockFormProvider>
        <SigningAuthority />
      </MockFormProvider>,
      { wrapper }
    )
    expect(screen.getByText('transfer:saLabel')).toBeInTheDocument()
  })

  it('renders checkbox and allows checking/unchecking', () => {
    render(
      <MockFormProvider>
        <SigningAuthority />
      </MockFormProvider>,
      { wrapper }
    )
    expect(screen.getByLabelText('transfer:saConfirmation')).toBeInTheDocument()

    const checkbox = screen.getByLabelText('transfer:saConfirmation')
    // Initially unchecked
    expect(checkbox.checked).toEqual(false)

    // Check the checkbox
    fireEvent.click(checkbox)
    expect(checkbox.checked).toEqual(true)

    // Uncheck the checkbox
    fireEvent.click(checkbox)
    expect(checkbox.checked).toEqual(false)
  })

  it('checkbox has defaultChecked as false', () => {
    render(
      <MockFormProvider>
        <SigningAuthority />
      </MockFormProvider>,
      { wrapper }
    )
    const checkbox = screen.getByLabelText('transfer:saConfirmation')
    expect(checkbox).not.toBeChecked()
  })
})
