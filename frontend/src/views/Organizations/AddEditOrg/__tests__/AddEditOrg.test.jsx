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

  // TODO: Fix timeout issue
  // it('submits form data correctly for CREATE', async () => {
  //   useParams.mockReturnValue({ orgID: undefined })

  //   render(
  //     <MockFormProvider>
  //       <AddEditOrgForm />
  //     </MockFormProvider>,
  //     { wrapper }
  //   )

  //   fireEvent.change(screen.getByLabelText(/org:legalNameLabel/i), {
  //     target: { value: 'New Create Org' }
  //   })
  //   fireEvent.change(screen.getByLabelText(/org:operatingNameLabel/i), {
  //     target: { value: 'New Create Operating Org' }
  //   })
  //   fireEvent.change(screen.getByLabelText(/org:emailAddrLabel/i), {
  //     target: { value: 'create@example.com' }
  //   })
  //   fireEvent.change(screen.getByLabelText(/org:phoneNbrLabel/i), {
  //     target: { value: '111-222-3333' }
  //   })

  //   const serviceAddressSection = screen.getByTestId('service-address-section')
  //   const headOfficeAddressSection = screen.getByTestId(
  //     'head-office-address-section'
  //   )

  //   fireEvent.change(within(serviceAddressSection).getByRole('combobox'), {
  //     target: { value: '1 Service St' }
  //   })
  //   fireEvent.change(
  //     within(serviceAddressSection).getByLabelText(/org:cityLabel/i),
  //     {
  //       target: { value: 'Service City' }
  //     }
  //   )
  //   fireEvent.change(
  //     within(serviceAddressSection).getByLabelText(/org:poLabel/i),
  //     {
  //       target: { value: 'S1S 1S1' }
  //     }
  //   )

  //   fireEvent.change(
  //     within(headOfficeAddressSection).getByLabelText(/org:streetAddrLabel/i),
  //     {
  //       target: { value: '1 Head Office St' }
  //     }
  //   )
  //   fireEvent.change(
  //     within(headOfficeAddressSection).getByLabelText(/org:cityLabel/i),
  //     {
  //       target: { value: 'Head Office City' }
  //     }
  //   )
  //   fireEvent.change(
  //     within(headOfficeAddressSection).getByLabelText(/org:poZipLabel/i),
  //     {
  //       target: { value: 'H0H 0H0' }
  //     }
  //   )

  //   fireEvent.click(screen.getByTestId('saveOrganization'))

  //   await waitFor(() => {
  //     expect(apiSpy.post).toHaveBeenCalledWith(
  //       '/organizations/create',
  //       expect.any(Object)
  //     )
  //     expect(mockNavigate).toHaveBeenCalledWith(ROUTES.ORGANIZATIONS.LIST, {
  //       state: {
  //         message: 'Organization has been successfully added.',
  //         severity: 'success'
  //       }
  //     })
  //   })
  // })
})
