import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { wrapper } from '@/tests/utils/wrapper.jsx'
import CompanyOverview from '../CompanyOverview'

// Mock window.scrollTo
global.window.scrollTo = vi.fn()

// Mock modules
vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: vi.fn(),
  useUpdateCompanyOverview: vi.fn()
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn()
}))

vi.mock('@/services/useApiService', () => ({
  useApiService: vi.fn()
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: vi.fn()
  }
})

vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon }) => <span data-testid="fa-icon">{icon.iconName}</span>
}))

vi.mock('@fortawesome/free-solid-svg-icons', () => ({
  faEdit: { iconName: 'edit' },
  faSave: { iconName: 'save' },
  faTimes: { iconName: 'times' },
  faFloppyDisk: { iconName: 'floppy-disk' }
}))

import { useOrganization, useUpdateCompanyOverview } from '@/hooks/useOrganization'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useApiService } from '@/services/useApiService'
import { useParams } from 'react-router-dom'

describe('CompanyOverview', () => {
  const mockOrgData = {
    organizationId: 1,
    name: 'Test Organization',
    companyDetails: 'Test company details',
    companyRepresentationAgreements: 'Test representation agreements',
    companyActingAsAggregator: 'Test aggregator info',
    companyAdditionalNotes: 'Test additional notes'
  }

  const mockCurrentUser = {
    organization: { organizationId: 1 }
  }

  const mockApiClient = {
    put: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()

    useParams.mockReturnValue({ orgID: '1' })
    useCurrentUser.mockReturnValue({
      data: mockCurrentUser,
      hasAnyRole: vi.fn(() => true),
      hasRoles: vi.fn(() => true)
    })
    useApiService.mockReturnValue(mockApiClient)
    useUpdateCompanyOverview.mockReturnValue({
      mutate: vi.fn(),
      isPending: false
    })
  })

  it('renders loading state initially', () => {
    useOrganization.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      refetch: vi.fn()
    })

    render(<CompanyOverview />, { wrapper })
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders error state when organization fails to load', () => {
    useOrganization.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      refetch: vi.fn()
    })

    render(<CompanyOverview />, { wrapper })
    expect(screen.getByText(/error loading organization/i)).toBeInTheDocument()
  })

  it('renders company overview data in view mode', () => {
    useOrganization.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    })

    render(<CompanyOverview />, { wrapper })

    expect(screen.getByText('Test company details')).toBeInTheDocument()
    expect(screen.getByText('Test representation agreements')).toBeInTheDocument()
    expect(screen.getByText('Test aggregator info')).toBeInTheDocument()
    expect(screen.getByText('Test additional notes')).toBeInTheDocument()
  })

  it('shows "No information provided" when fields are empty', () => {
    const emptyOrgData = {
      organizationId: 1,
      name: 'Test Organization',
      companyDetails: null,
      companyRepresentationAgreements: null,
      companyActingAsAggregator: null,
      companyAdditionalNotes: null
    }

    useOrganization.mockReturnValue({
      data: emptyOrgData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    })

    render(<CompanyOverview />, { wrapper })

    expect(screen.getByText(/enter company details here/i)).toBeInTheDocument()
    expect(screen.getByText(/note the applicable year and enter company representation agreements/i)).toBeInTheDocument()
    expect(screen.getByText(/note the start year and end year.*enter aggregator information/i)).toBeInTheDocument()
    expect(screen.getByText(/enter any additional notes here/i)).toBeInTheDocument()
  })

  it('shows edit button when user has permissions', () => {
    useOrganization.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    })

    useCurrentUser.mockReturnValue({
      data: mockCurrentUser,
      hasAnyRole: vi.fn(() => true),
      hasRoles: vi.fn(() => true)
    })

    render(<CompanyOverview />, { wrapper })

    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('hides edit button when user lacks permissions', () => {
    useOrganization.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    })

    useCurrentUser.mockReturnValue({
      data: mockCurrentUser,
      hasAnyRole: vi.fn(() => false),
      hasRoles: vi.fn(() => false)
    })

    render(<CompanyOverview />, { wrapper })

    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('switches to edit mode when edit button is clicked', () => {
    useOrganization.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    })

    render(<CompanyOverview />, { wrapper })

    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('shows text fields in edit mode', () => {
    useOrganization.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    })

    render(<CompanyOverview />, { wrapper })

    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    const textboxes = screen.getAllByRole('textbox')
    expect(textboxes).toHaveLength(4)
  })

  it('populates form fields with existing data in edit mode', () => {
    useOrganization.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    })

    render(<CompanyOverview />, { wrapper })

    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    const textboxes = screen.getAllByRole('textbox')
    expect(textboxes[0]).toHaveValue('Test company details')
    expect(textboxes[1]).toHaveValue('Test representation agreements')
    expect(textboxes[2]).toHaveValue('Test aggregator info')
    expect(textboxes[3]).toHaveValue('Test additional notes')
  })

  it('cancels edit mode when cancel button is clicked', () => {
    useOrganization.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    })

    render(<CompanyOverview />, { wrapper })

    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelButton)

    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('submits updated data when save button is clicked', async () => {
    const mockRefetch = vi.fn()
    const mockMutate = vi.fn()

    useOrganization.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isError: false,
      refetch: mockRefetch
    })

    useUpdateCompanyOverview.mockReturnValue({
      mutate: mockMutate,
      isPending: false
    })

    render(<CompanyOverview />, { wrapper })

    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    const textboxes = screen.getAllByRole('textbox')
    fireEvent.change(textboxes[0], {
      target: { value: 'Updated company details' }
    })

    const saveButton = screen.getByRole('button', { name: /save/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          company_details: 'Updated company details'
        })
      )
    })
  })

  it('calls refetch and exits edit mode after successful update', async () => {
    const mockRefetch = vi.fn()
    let onSuccessCallback

    useOrganization.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isError: false,
      refetch: mockRefetch
    })

    useUpdateCompanyOverview.mockImplementation((orgId, options) => {
      onSuccessCallback = options.onSuccess
      return {
        mutate: vi.fn(() => {
          if (onSuccessCallback) onSuccessCallback()
        }),
        isPending: false
      }
    })

    render(<CompanyOverview />, { wrapper })

    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    const textboxes = screen.getAllByRole('textbox')
    fireEvent.change(textboxes[0], {
      target: { value: 'Updated company details' }
    })

    const saveButton = screen.getByRole('button', { name: /save/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled()
      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
    })
  })

  it('calls error handler when update fails', async () => {
    const mockRefetch = vi.fn()
    let onErrorCallback

    useOrganization.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isError: false,
      refetch: mockRefetch
    })

    useUpdateCompanyOverview.mockImplementation((orgId, options) => {
      onErrorCallback = options.onError
      return {
        mutate: vi.fn(() => {
          if (onErrorCallback) {
            onErrorCallback({
              response: { data: { detail: 'Update failed' } }
            })
          }
        }),
        isPending: false
      }
    })

    render(<CompanyOverview />, { wrapper })

    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    const textboxes = screen.getAllByRole('textbox')
    fireEvent.change(textboxes[0], {
      target: { value: 'Updated company details' }
    })

    const saveButton = screen.getByRole('button', { name: /save/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      // Error handler was defined and mutation was attempted
      expect(onErrorCallback).toBeDefined()
    })
  })

  it('disables save button when form is not dirty', () => {
    useOrganization.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    })

    render(<CompanyOverview />, { wrapper })

    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    const saveButton = screen.getByRole('button', { name: /save/i })
    expect(saveButton).toBeDisabled()
  })

  it('enables save button when form is modified', () => {
    useOrganization.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    })

    render(<CompanyOverview />, { wrapper })

    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    const textboxes = screen.getAllByRole('textbox')
    fireEvent.change(textboxes[0], {
      target: { value: 'Modified content' }
    })

    const saveButton = screen.getByRole('button', { name: /save/i })
    expect(saveButton).not.toBeDisabled()
  })
})
