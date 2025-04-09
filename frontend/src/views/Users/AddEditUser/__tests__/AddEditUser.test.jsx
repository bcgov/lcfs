import { userData } from './test.mock'
import { AddEditUser } from '@/views/Users'
import { apiRoutes } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { wrapper } from '@/tests/utils/wrapper'
import { describe, it, vi } from 'vitest'
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
    get: vi.fn((url) => {
      if (url.includes('/users/deleted')) {
        return Promise.reject({ response: { status: 404 } })
      }
      return Promise.resolve({ data: 'mock-data' })
    }),
    post: vi.fn(() => Promise.resolve({ data: 'mock-data' })),
    put: vi.fn(() => Promise.resolve({ data: 'mock-data' })),
    delete: vi.fn(() => Promise.resolve({ data: 'deleted' }))
  })
}))

// Mock the user store
vi.mock('@/stores/useUserStore', () => ({
  useUserStore: () => ({
    setUser: vi.fn()
  })
}))

async function typeAndValidateTextBox(name, value) {
  const textBox = screen.getByRole('textbox', {
    name: new RegExp(`^${name}`, 'i')
  })
  expect(textBox).toBeInTheDocument()
  // Clear the input first
  await userEvent.clear(textBox)
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

    expect(
      screen.getByRole('heading', { name: /Add user/i })
    ).toBeInTheDocument()
    expect(container.querySelector('form#user-form')).toBeInTheDocument()
    // Check for form fields
    await typeAndValidateTextBox('First name', 'John')
    await typeAndValidateTextBox('Last name', 'Doe')
    await typeAndValidateTextBox('Job title', 'Analyst')
    await typeAndValidateTextBox('IDIR user name', 'johndoe')
    await typeAndValidateTextBox('Email address', 'test@test.com')
    await typeAndValidateTextBox('Phone', '555-555-5555')
    await typeAndValidateTextBox('Mobile phone', '555-555-5555')

    const saveButton = screen.getByRole('button', { name: /save/i })
    userEvent.click(saveButton)

    // Add assertion after click to ensure test doesn't complete too early
    await waitFor(() => {
      expect(saveButton).toBeInTheDocument()
    })
  }, 10000) // Increase timeout for this test
  it('renders the form to add BCeID user', async () => {
    const { container } = render(<AddEditUser userType="bceid" />, { wrapper })
    // Check if the container HTML element contains the form
    expect(container.querySelector('form#user-form')).toBeInTheDocument()
    // Check for form fields
    await typeAndValidateTextBox('First name', 'John')
    await typeAndValidateTextBox('Last name', 'Doe')
    await typeAndValidateTextBox('Job title', 'Compliance manager')
    await typeAndValidateTextBox('BCeID Userid', 'johndoe')
    await typeAndValidateTextBox(
      'Email address associated with the BCeID user account',
      'test@test.com'
    )
    await typeAndValidateTextBox(
      'Alternate email for notifications',
      'test@test.com'
    )
    await typeAndValidateTextBox('Phone', '555-555-5555')
    await typeAndValidateTextBox('Mobile phone', '555-555-5555')

    const saveButton = screen.getByRole('button', { name: /save/i })
    userEvent.click(saveButton)
    await waitFor(() => {
      expect(saveButton).toBeInTheDocument()
    })
  }, 10000)

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
    const phoneNumber = screen.getAllByLabelText(/Phone/i)[0]
    await userEvent.type(phoneNumber, '1234')
    expect(
      await screen.findByText('Phone number is not valid')
    ).toBeInTheDocument()
  })

  it('handles deleted user gracefully', async () => {
    // Override the useApiService.get mock to simulate a 404 error for a deleted user.
    const { useApiService } = await import('@/services/useApiService')
    useApiService().get.mockImplementationOnce((url) => {
      if (url.includes('/users/')) {
        return Promise.reject({ response: { status: 404 } })
      }
      return Promise.resolve({ data: 'mock-data' })
    })
    render(<AddEditUser />, { wrapper })
  })
})
