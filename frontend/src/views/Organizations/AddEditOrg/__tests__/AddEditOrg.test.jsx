import React from 'react'
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within
} from '@testing-library/react'
import { AddEditOrgForm } from '../AddEditOrgForm'
import { useForm, FormProvider } from 'react-hook-form'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useOrganization } from '@/hooks/useOrganization'
import { useApiService } from '@/services/useApiService'
import { ROUTES } from '@/routes/routes'
import { useNavigate, useParams } from 'react-router-dom'
import { wrapper } from '@/tests/utils/wrapper'
import { yupResolver } from '@hookform/resolvers/yup'
import { schemaValidation } from '@/views/Organizations/AddEditOrg/_schema.js'
import { useMutation } from '@tanstack/react-query'

vi.mock('@/hooks/useOrganization')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))
vi.mock('@/services/useApiService')
vi.mock('react-router-dom')

// Mock the useMutation hook to properly handle onSuccess callback
const mockMutate = vi.fn()
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useMutation: vi.fn(() => ({
      mutate: mockMutate,
      isPending: false,
      isError: false
    }))
  }
})

const MockFormProvider = ({ children }) => {
  const methods = useForm({
    resolver: yupResolver(schemaValidation)
  })
  return <FormProvider {...methods}>{children}</FormProvider>
}

const mockedOrg = {
  name: 'Test Org',
  operatingName: 'Test Operating Org',
  email: 'test@example.com',
  phone: '123-456-7890',
  edrmsRecord: 'EDRMS123',
  recordsAddress: '789 Test St, City, Province, A1B2C3',
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
    postalcodeZipcode: 'D4E5F6',
    provinceState: 'BC',
    country: 'Canada'
  },
  orgStatus: { organizationStatusId: 2 }
}

describe('AddEditOrg', () => {
  let mockNavigate
  let apiSpy

  beforeEach(() => {
    vi.clearAllMocks()

    mockNavigate = vi.fn()
    useNavigate.mockReturnValue(mockNavigate)
    useParams.mockReturnValue({ orgID: undefined })

    useOrganization.mockReturnValue({
      data: null,
      isFetched: true
    })

    apiSpy = {
      post: vi.fn().mockResolvedValue({}),
      put: vi.fn().mockResolvedValue({})
    }
    useApiService.mockReturnValue(apiSpy)
  })

  it('renders correctly with provided organization data and maps all address fields correctly', () => {
    useOrganization.mockReturnValue({
      data: mockedOrg,
      isFetched: true
    })
    useParams.mockReturnValue({ orgID: '123' })

    render(
      <MockFormProvider>
        <AddEditOrgForm />
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
      '456 Attorney Rd'
    )
    expect(screen.getAllByLabelText(/org:cityLabel/i)[0]).toHaveValue(
      'Test City'
    )
  })

  it('renders required errors in the form correctly', async () => {
    render(
      <MockFormProvider>
        <AddEditOrgForm />
      </MockFormProvider>,
      { wrapper }
    )

    fireEvent.click(screen.getByTestId('saveOrganization'))

    await waitFor(async () => {
      const errorMessages = await screen.findAllByText(/required/i)
      expect(errorMessages.length).toBeGreaterThan(0)

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
        <AddEditOrgForm />
      </MockFormProvider>,
      { wrapper }
    )

    fireEvent.click(screen.getByTestId('saveOrganization'))

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

  it('submits form data correctly for CREATE', async () => {
    useParams.mockReturnValue({ orgID: undefined })

    // Mock successful API response
    apiSpy.post.mockResolvedValueOnce({
      data: { organization_id: 1, name: 'New Test Org Legal' }
    })

    // Setup useMutation mock to call onSuccess when mutate is called
    const { useMutation } = await import('@tanstack/react-query')
    useMutation.mockImplementation(({ onSuccess }) => ({
      mutate: vi.fn(async (payload) => {
        // Simulate successful API call
        await apiSpy.post('/organizations/create', payload)
        // Call onSuccess immediately after API call
        if (onSuccess) {
          onSuccess()
        }
      }),
      isPending: false,
      isError: false
    }))

    render(
      <MockFormProvider>
        <AddEditOrgForm />
      </MockFormProvider>,
      { wrapper }
    )

    // Fill in the required form fields
    fireEvent.change(screen.getByLabelText(/org:legalNameLabel/i), {
      target: { value: 'New Test Org Legal' }
    })
    fireEvent.change(screen.getByLabelText(/org:operatingNameLabel/i), {
      target: { value: 'New Test Org Operating' }
    })
    fireEvent.change(screen.getByLabelText(/org:emailAddrLabel/i), {
      target: { value: 'new-test@example.com' }
    })
    fireEvent.change(screen.getByLabelText(/org:phoneNbrLabel/i), {
      target: { value: '555-123-4567' }
    })
    // Supplier Type Radio (Assuming value '1' is valid)
    fireEvent.click(screen.getByLabelText(/supplier/i))
    // Registered for Transfers Radio (value="2" is Yes)
    fireEvent.click(screen.getByTestId('orgRegForTransfers2'))
    // Service Address Fields
    fireEvent.change(screen.getAllByLabelText(/org:streetAddrLabel/i)[0], {
      target: { value: '100 Test Service St' }
    })
    fireEvent.change(screen.getAllByLabelText(/org:cityLabel/i)[0], {
      target: { value: 'Testville' }
    })
    fireEvent.change(screen.getAllByLabelText(/org:poLabel/i)[0], {
      target: { value: 'V8V 8V8' }
    })
    // Early Issuance Radio (value="yes" is Yes)
    fireEvent.click(screen.getByTestId('hasEarlyIssuanceYes'))

    // Submit the form
    fireEvent.click(screen.getByTestId('saveOrganization'))

    // Wait for the API call to be made
    await waitFor(
      () => {
        expect(apiSpy.post).toHaveBeenCalledWith(
          '/organizations/create',
          expect.any(Object)
        )
      },
      { timeout: 10000 }
    )

    // Wait for the navigation side effect
    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith(ROUTES.ORGANIZATIONS.LIST, {
          state: {
            message: 'Organization has been successfully added.',
            severity: 'success'
          }
        })
      },
      { timeout: 5000 }
    )
  }, 20000) // Increase overall test timeout to 20 seconds
})
