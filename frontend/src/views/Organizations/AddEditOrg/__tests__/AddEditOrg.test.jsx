import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddEditOrg } from '../AddEditOrg'
import { useForm, FormProvider } from 'react-hook-form'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useOrganization } from '@/hooks/useOrganization'
import { useApiService } from '@/services/useApiService'
import { ROUTES } from '@/constants/routes'
import { useNavigate, useParams } from 'react-router-dom'
import { wrapper } from '@/tests/utils/wrapper'
import { yupResolver } from '@hookform/resolvers/yup'
import { schemaValidation } from '@/views/Organizations/AddEditOrg/_schema.js'

vi.mock('@/hooks/useOrganization')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))
vi.mock('@/services/useApiService')
vi.mock('react-router-dom')

const MockFormProvider = ({ children }) => {
  const methods = useForm({
    resolver: yupResolver(schemaValidation),
    mode: 'all'
  })
  return <FormProvider {...methods}>{children}</FormProvider>
}

const mockedOrg = {
  name: 'Test Org',
  operatingName: 'Test Operating Org',
  email: 'test@example.com',
  phone: '123-456-7890',
  edrmsRecord: 'EDRMS123',
  orgAddress: {
    streetAddress: '123 Test St',
    addressOther: '',
    city: 'Test City',
    postalcodeZipcode: 'A1B2C3'
  },
  orgAttorneyAddress: {
    streetAddress: '456 Attorney Rd',
    addressOther: '',
    city: 'Attorney City',
    postalcodeZipcode: 'D4E5F6'
  },
  orgStatus: { organizationStatusId: 2 }
}

describe('AddEditOrg', () => {
  let mockNavigate
  let apiSpy

  beforeEach(() => {
    mockNavigate = vi.fn()
    useNavigate.mockReturnValue(mockNavigate)
    useParams.mockReturnValue({ orgId: undefined })

    // Mocking the useOrganization hook
    useOrganization.mockReturnValue({
      isFetched: true
    })

    apiSpy = {
      post: vi.fn(),
      put: vi.fn()
    }
    // Mocking the useApiService hook
    useApiService.mockReturnValue(apiSpy)
  })

  it('renders correctly with provided organization data', () => {
    useOrganization.mockReturnValue({
      data: mockedOrg,
      isFetched: true
    })

    render(
      <MockFormProvider>
        <AddEditOrg />
      </MockFormProvider>,
      { wrapper }
    )

    expect(screen.getByLabelText(/org:legalNameLabel/i)).toHaveValue('Test Org')
    expect(screen.getByLabelText(/org:operatingNameLabel/i)).toHaveValue(
      'Test Operating Org'
    )
    expect(screen.getByLabelText(/org:emailAddrLabel/i)).toHaveValue(
      'test@example.com'
    )
    expect(screen.getByLabelText(/org:phoneNbrLabel/i)).toHaveValue(
      '123-456-7890'
    )
    expect(screen.getAllByLabelText(/org:streetAddrLabel/i)[0]).toHaveValue(
      '123 Test St'
    )
    expect(screen.getAllByLabelText(/org:cityLabel/i)[0]).toHaveValue(
      'Test City'
    )
    expect(screen.getAllByLabelText(/org:poLabel/i)[0]).toHaveValue('A1B2C3')
  })

  it('renders required errors in the form correctly', async () => {
    render(
      <MockFormProvider>
        <AddEditOrg />
      </MockFormProvider>,
      { wrapper }
    )

    // Simulate submitting the form without filling required fields
    fireEvent.click(screen.getByTestId('saveOrganization'))

    // Check for validation error messages
    await waitFor(async () => {
      const errorMessages = await screen.findAllByText(/required/i)
      expect(errorMessages.length).toBeGreaterThan(0)

      // Check for specific error messages
      expect(
        screen.getByText(/Legal Name of Organization is required./i)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Operating Name of Organization is required./i)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Email Address is required./i)
      ).toBeInTheDocument()
      expect(screen.getByText(/Phone Number is required./i)).toBeInTheDocument()
    })
  })

  it('renders unique error messages for specific fields', async () => {
    useOrganization.mockReturnValue({
      data: {
        ...mockedOrg,
        phone: 'f91j5qhf91',
        orgAddress: {
          postalcodeZipcode: '2671224'
        }
      },
      isFetched: true
    })

    render(
      <MockFormProvider>
        <AddEditOrg />
      </MockFormProvider>,
      { wrapper }
    )

    // Simulate submitting the form without filling required fields
    fireEvent.click(screen.getByTestId('saveOrganization'))

    // Check for validation error messages
    await waitFor(async () => {
      expect(
        screen.getByText(
          /Invalid format. Only numbers, spaces, parentheses, plus signs, and hyphens are allowed./i
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Please enter a valid Postal \/ ZIP Code./i)
      ).toBeInTheDocument()
    })
  })

  it('submits form data correctly', async () => {
    useOrganization.mockReturnValue({
      data: mockedOrg,
      isFetched: true
    })

    render(
      <MockFormProvider>
        <AddEditOrg />
      </MockFormProvider>,
      { wrapper }
    )

    // Fill in the form fields
    fireEvent.change(screen.getByLabelText(/org:legalNameLabel/i), {
      target: { value: 'New Org' }
    })
    fireEvent.change(screen.getByLabelText(/org:operatingNameLabel/i), {
      target: { value: 'New Operating Org' }
    })
    fireEvent.change(screen.getByLabelText(/org:emailAddrLabel/i), {
      target: { value: 'new@example.com' }
    })
    fireEvent.change(screen.getByLabelText(/org:phoneNbrLabel/i), {
      target: { value: '987-654-3210' }
    })

    // Submit the form
    fireEvent.click(screen.getByTestId('saveOrganization'))

    await waitFor(() => {
      // Check that the correct API call was made
      expect(apiSpy.post).toHaveBeenCalledWith(
        '/organizations/create',
        expect.any(Object)
      )
    })

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.ORGANIZATIONS, {
      state: {
        message: 'Organization has been successfully added.',
        severity: 'success'
      }
    })
  })
})
