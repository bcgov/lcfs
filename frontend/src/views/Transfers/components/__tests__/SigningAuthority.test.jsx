import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { SigningAuthority } from '../SigningAuthority'
import SigningAuthorityWithRole from '../SigningAuthority'
import { FormProvider, useForm } from 'react-hook-form'
import { describe, expect, vi, beforeEach } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/utils/withRole', () => ({
  default: (component) => component
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => <div data-test="bc-typography" {...props}>{children}</div>
}))

const MockFormProvider = ({ children, formProps = {} }) => {
  const methods = useForm(formProps)
  return <FormProvider {...methods}>{children}</FormProvider>
}

const MockFormProviderWithErrors = ({ children }) => {
  const methods = useForm({
    defaultValues: { signingAuthorityDeclaration: false },
    mode: 'onChange'
  })
  
  // Override the formState errors via Object.defineProperty to avoid read-only error
  Object.defineProperty(methods.formState, 'errors', {
    value: {
      signingAuthorityDeclaration: {
        message: 'This field is required'
      }
    },
    writable: false
  })
  
  return <FormProvider {...methods}>{children}</FormProvider>
}

describe('SigningAuthority Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it('contains correct data-test attributes', () => {
    render(
      <MockFormProvider>
        <SigningAuthority />
      </MockFormProvider>,
      { wrapper }
    )
    expect(screen.getByTestId('signing-authority')).toBeInTheDocument()
    expect(screen.getByTestId('signing-authority-checkbox')).toBeInTheDocument()
  })

  it('checkbox renders and is unchecked by default', () => {
    render(
      <MockFormProvider>
        <SigningAuthority />
      </MockFormProvider>,
      { wrapper }
    )
    const checkbox = screen.getByTestId('signing-authority-checkbox')
    expect(checkbox).not.toBeChecked()
  })

  it('integrates with withRole HOC', () => {
    render(
      <MockFormProvider>
        <SigningAuthorityWithRole />
      </MockFormProvider>,
      { wrapper }
    )
    expect(screen.getByText('transfer:saLabel')).toBeInTheDocument()
  })

  it('uses translation keys correctly', () => {
    render(
      <MockFormProvider>
        <SigningAuthority />
      </MockFormProvider>,
      { wrapper }
    )
    expect(screen.getByText('transfer:saLabel')).toBeInTheDocument()
    expect(screen.getByText('transfer:saConfirmation')).toBeInTheDocument()
  })

  it('does not display error by default', () => {
    render(
      <MockFormProvider>
        <SigningAuthority />
      </MockFormProvider>,
      { wrapper }
    )
    // Check that no error message is displayed when there are no errors
    const errorElements = screen.queryAllByText(/error/i)
    expect(errorElements).toHaveLength(0)
  })
})