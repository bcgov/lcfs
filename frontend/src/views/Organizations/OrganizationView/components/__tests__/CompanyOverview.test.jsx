import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import CompanyOverview from '../CompanyOverview'

// Mock modules
vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: vi.fn()
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
  faTimes: { iconName: 'times' }
}))

import { useOrganization } from '@/hooks/useOrganization'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useApiService } from '@/services/useApiService'
import { useParams } from 'react-router-dom'

const renderWithProviders = (component) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>
  )
}

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
      hasRoles: vi.fn(() => true)
    })
    useApiService.mockReturnValue(mockApiClient)
  })

  it('renders loading state initially', () => {
    useOrganization.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      refetch: vi.fn()
    })

    renderWithProviders(<CompanyOverview />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders error state when organization fails to load', () => {
    useOrganization.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      refetch: vi.fn()
    })

    renderWithProviders(<CompanyOverview />)
    expect(screen.getByText(/error loading organization/i)).toBeInTheDocument()
  })

  it('renders company overview data in view mode', () => {
    useOrganization.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    })

    renderWithProviders(<CompanyOverview />)

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

    renderWithProviders(<CompanyOverview />)

    const noInfoTexts = screen.getAllByText(/no information provided/i)
    expect(noInfoTexts).toHaveLength(4)
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
      hasRoles: vi.fn(() => true)
    })

    renderWithProviders(<CompanyOverview />)

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
      hasRoles: vi.fn(() => false)
    })

    renderWithProviders(<CompanyOverview />)

    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('switches to edit mode when edit button is clicked', () => {
    useOrganization.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    })

    renderWithProviders(<CompanyOverview />)

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

    renderWithProviders(<CompanyOverview />)

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

    renderWithProviders(<CompanyOverview />)

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

    renderWithProviders(<CompanyOverview />)

    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelButton)

    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('submits updated data when save button is clicked', async () => {
    const mockRefetch = vi.fn()
    mockApiClient.put.mockResolvedValue({ data: mockOrgData })

    useOrganization.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isError: false,
      refetch: mockRefetch
    })

    renderWithProviders(<CompanyOverview />)

    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    const textboxes = screen.getAllByRole('textbox')
    fireEvent.change(textboxes[0], {
      target: { value: 'Updated company details' }
    })

    const saveButton = screen.getByRole('button', { name: /save/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockApiClient.put).toHaveBeenCalledWith(
        '/organizations/1/company-overview',
        expect.objectContaining({
          company_details: 'Updated company details'
        })
      )
    })
  })

  it('displays success message after successful update', async () => {
    const mockRefetch = vi.fn()
    mockApiClient.put.mockResolvedValue({ data: mockOrgData })

    useOrganization.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isError: false,
      refetch: mockRefetch
    })

    renderWithProviders(<CompanyOverview />)

    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    const textboxes = screen.getAllByRole('textbox')
    fireEvent.change(textboxes[0], {
      target: { value: 'Updated company details' }
    })

    const saveButton = screen.getByRole('button', { name: /save/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText(/company overview updated successfully/i)).toBeInTheDocument()
    })
  })

  it('displays error message when update fails', async () => {
    const mockRefetch = vi.fn()
    mockApiClient.put.mockRejectedValue({
      response: { data: { detail: 'Update failed' } }
    })

    useOrganization.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isError: false,
      refetch: mockRefetch
    })

    renderWithProviders(<CompanyOverview />)

    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    const textboxes = screen.getAllByRole('textbox')
    fireEvent.change(textboxes[0], {
      target: { value: 'Updated company details' }
    })

    const saveButton = screen.getByRole('button', { name: /save/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText(/update failed/i)).toBeInTheDocument()
    })
  })

  it('disables save button when form is not dirty', () => {
    useOrganization.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    })

    renderWithProviders(<CompanyOverview />)

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

    renderWithProviders(<CompanyOverview />)

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
