import { userData } from './test.mock'
import { AddEditUser } from '@/views/Users'
import { apiRoutes } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { wrapper } from '@/tests/utils/wrapper'
import { describe, it } from 'vitest'
import { HttpResponse } from 'msw'
import { httpOverwrite } from '@/tests/utils/handlers'

// Mock the Keycloak provider
vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'mock-token',
      authenticated: true,
      initialized: true
    }
  })
}))

// Mock the API service
vi.mock('@/services/useApiService', () => ({
  useApiService: () => ({
    get: vi.fn(() => Promise.resolve({ data: 'mock-data' }))
  })
}))

// Mock the user store
vi.mock('@/stores/useUserStore', () => ({
  useUserStore: () => ({
    setUser: vi.fn()
  })
}))

async function typeAndValidateTextBox(name, value) {
  const textBox = screen.getByRole('textbox', { name })
  expect(textBox).toBeInTheDocument()
  await userEvent.type(textBox, value, { delay: 10 })
  expect(textBox).toHaveValue(value)
}

describe('AddEditUser component', () => {
  beforeEach(async () => {
    httpOverwrite('get', apiRoutes.currentUser, () =>
      HttpResponse.json(userData)
    )
    const { result } = renderHook(useCurrentUser, { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })
  afterEach(() => {
    vi.resetAllMocks()
  })
  //  component renders correctly for different user types (IDIR and BCEID) and appropriately displays the form fields based on the user role.
  it('renders the form to add IDIR user', async () => {
    const { container } = render(<AddEditUser />, { wrapper })

    // Check for the heading with the name "Add user"
    const addUserHeading = screen.getByRole('heading', { name: 'Add user' })
    expect(addUserHeading).toBeInTheDocument()
    // Check if the container HTML element contains the form
    expect(container.querySelector('form#user-form')).toBeInTheDocument()
    // Check for form fields
    await typeAndValidateTextBox('First name', 'John')
    await typeAndValidateTextBox('Last name', 'Doe')
    await typeAndValidateTextBox('Job title', 'Analyst')
    await typeAndValidateTextBox('IDIR user name', 'johndoe')
    await typeAndValidateTextBox('Email address', 'test@test.com')
    await typeAndValidateTextBox('Phone (optional)', '555-555-5555')
    await typeAndValidateTextBox('Mobile phone (optional)', '555-555-5555')

    const saveButton = screen.getByRole('button', { name: /save/i })
    userEvent.click(saveButton)
  })
  it('renders the form to add BCeID user', async () => {
    const { container } = render(<AddEditUser userType="bceid" />, { wrapper })
    // Check if the container HTML element contains the form
    expect(container.querySelector('form#user-form')).toBeInTheDocument()
    // Check for form fields
    await typeAndValidateTextBox('First name', 'John')
    await typeAndValidateTextBox('Last name', 'Doe')
    await typeAndValidateTextBox('Job title (optional)', 'Compliance manager')
    await typeAndValidateTextBox('BCeID Userid', 'johndoe')
    await typeAndValidateTextBox(
      'Email address associated with the BCeID user account',
      'test@test.com'
    )
    await typeAndValidateTextBox(
      'Alternate email for notifications (optional)',
      'test@test.com'
    )
    await typeAndValidateTextBox('Phone (optional)', '555-555-5555')
    await typeAndValidateTextBox('Mobile phone (optional)', '555-555-5555')

    const saveButton = screen.getByRole('button', { name: /save/i })
    userEvent.click(saveButton)
  })
  it('validates user form', async () => {
    render(<AddEditUser />, { wrapper })

    // Attempt to submit the form without filling out the fields
    const saveButton = screen.getByRole('button', { name: /save/i })
    userEvent.click(saveButton)
    // Check for data validation errors.
    expect(
      await screen.findByText('First name is required.')
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Last name is required.')
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Job title is required.')
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Email address is required.')
    ).toBeInTheDocument()
    expect(await screen.findByText('User name is required')).toBeInTheDocument()
    const phoneNumber = screen.getByRole('textbox', {
      name: 'Phone (optional)'
    })
    await userEvent.type(phoneNumber, '1234')
    expect(
      await screen.findByText('Phone number is not valid')
    ).toBeInTheDocument()
  })
})
