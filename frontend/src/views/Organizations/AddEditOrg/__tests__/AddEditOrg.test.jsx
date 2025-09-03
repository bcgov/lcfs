import React from 'react'
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddEditOrgForm } from '../AddEditOrgForm'
import { useForm, FormProvider } from 'react-hook-form'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AddEditOrg } from '../AddEditOrg'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useOrganization, useOrganizationTypes } from '@/hooks/useOrganization'
import { useApiService } from '@/services/useApiService'
import { ROUTES } from '@/routes/routes'
import { useNavigate, useParams } from 'react-router-dom'
import { wrapper } from '@/tests/utils/wrapper'
import { yupResolver } from '@hookform/resolvers/yup'
import { schemaValidation } from '@/views/Organizations/AddEditOrg/_schema.js'
import { useMutation } from '@tanstack/react-query'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn()
}))

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: vi.fn()
}))

// Mock AddressAutocomplete to prevent network requests
vi.mock('@/components/BCForm/AddressAutocomplete', () => ({
  AddressAutocomplete: React.forwardRef(
    (
      {
        name,
        placeholder = 'Start typing address...',
        value,
        onChange,
        onBlur,
        error
      },
      ref
    ) => (
      <input
        ref={ref}
        id={name}
        name={name}
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => onChange && onChange(e.target.value)}
        onBlur={onBlur}
        data-testid={`address-autocomplete-${name}`}
        aria-label={name?.includes('street') ? 'org:streetAddrLabel' : name}
      />
    )
  )
}))

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

// Mock hooks
vi.mock('@/hooks/useOrganization')
vi.mock('@/services/useApiService')

// Mock BCWidgetCard component
vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  default: vi.fn(({ title, content, id, color, 'data-test': dataTest }) => (
    <div
      data-test="bc-widget-card"
      data-container-test={dataTest}
      data-title={title}
      data-id={id}
      data-color={color}
    >
      {content}
    </div>
  ))
}))

// Mock AddEditOrgForm component
vi.mock('../AddEditOrgForm', () => ({
  AddEditOrgForm: vi.fn(() => <div data-test="add-edit-org-form" />)
}))

describe('AddEditOrg', () => {
  const mockT = vi.fn((key) => `translated-${key}`)

  beforeEach(() => {
    vi.clearAllMocks()
    useTranslation.mockReturnValue({ t: mockT })
    useOrganizationTypes.mockReturnValue({
      data: [],
      isLoading: false,
      error: null
    })
    useApiService.mockReturnValue({
      post: vi.fn(),
      put: vi.fn()
    })

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
      '123 Test St'
    )
    expect(screen.getAllByLabelText(/org:cityLabel/i)[0]).toHaveValue(
      'Test City'
    )
    // Also check attorney address if there are multiple address fields
    const streetAddressFields = screen.getAllByLabelText(/org:streetAddrLabel/i)
    if (streetAddressFields.length > 1) {
      expect(streetAddressFields[1]).toHaveValue('456 Attorney Rd')
    }
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

  it('renders in edit mode when orgID is present', () => {
    // Arrange
    useParams.mockReturnValue({ orgID: 'test-org-123' })

    // Act
    render(<AddEditOrg />)

    // Assert
    expect(screen.getByTestId('bc-widget-card')).toBeInTheDocument()
    expect(screen.getByTestId('add-edit-org-form')).toBeInTheDocument()
    expect(mockT).toHaveBeenCalledWith('org:editOrgTitle')
    expect(screen.getByTestId('bc-widget-card')).toHaveAttribute(
      'data-title',
      'translated-org:editOrgTitle'
    )
  })

  it('renders in add mode when orgID is not present', () => {
    // Arrange
    useParams.mockReturnValue({ orgID: undefined })

    // Act
    render(<AddEditOrg />)

    // Assert
    expect(screen.getByTestId('bc-widget-card')).toBeInTheDocument()
    expect(screen.getByTestId('add-edit-org-form')).toBeInTheDocument()
    expect(mockT).toHaveBeenCalledWith('org:addOrgTitle')
    expect(screen.getByTestId('bc-widget-card')).toHaveAttribute(
      'data-title',
      'translated-org:addOrgTitle'
    )
  })

  it('renders with correct static props for BCWidgetCard', () => {
    // Arrange
    useParams.mockReturnValue({ orgID: 'test-id' })

    // Act
    render(<AddEditOrg />)

    // Assert
    const widgetCard = screen.getByTestId('bc-widget-card')
    expect(widgetCard).toHaveAttribute('data-id', 'user-card')
    expect(widgetCard).toHaveAttribute('data-color', 'nav')
    expect(widgetCard).toHaveAttribute(
      'data-container-test',
      'addEditOrgContainer'
    )
  })

  it('calls useTranslation hook with correct parameters', () => {
    // Arrange
    useParams.mockReturnValue({ orgID: 'test-id' })

    // Act
    render(<AddEditOrg />)

    // Assert
    expect(useTranslation).toHaveBeenCalledWith(['common', 'org'])
  })

  it('calls useParams hook to extract orgID', () => {
    // Arrange
    const testOrgId = 'test-organization-id'
    useParams.mockReturnValue({ orgID: testOrgId })

    // Act
    render(<AddEditOrg />)

    // Assert
    expect(useParams).toHaveBeenCalled()
    // Verify the title uses edit mode since orgID is present
    expect(mockT).toHaveBeenCalledWith('org:editOrgTitle')
  })

  it('renders AddEditOrgForm component within BCWidgetCard content', () => {
    // Arrange
    useParams.mockReturnValue({ orgID: 'test-id' })

    // Act
    render(<AddEditOrg />)

    // Assert
    expect(screen.getByTestId('add-edit-org-form')).toBeInTheDocument()
    expect(screen.getByTestId('bc-widget-card')).toBeInTheDocument()
    // Verify the form is rendered as the content of the widget card
    const widgetCard = screen.getByTestId('bc-widget-card')
    const form = screen.getByTestId('add-edit-org-form')
    expect(widgetCard).toContainElement(form)
  })
})
