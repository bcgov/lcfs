import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as OrganizationSnapshotHooks from '@/hooks/useOrganizationSnapshot.js'
import { OrganizationAddress } from '../OrganizationAddress'
import { wrapper } from '@/tests/utils/wrapper.jsx'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/hooks/useOrganizationSnapshot.js')

describe('OrganizationAddress', () => {
  // Shared variables
  let snapshotData
  let setIsEditingMock
  let mockMutate

  beforeEach(() => {
    vi.clearAllMocks()

    // Create fresh mocks/objects for each test so they don't carry state
    snapshotData = {
      name: 'ACME Corporation',
      operatingName: 'ACME',
      phone: '250-123-4567',
      email: 'info@acme.com',
      serviceAddress: '123 Main St.',
      bcAddress: '456 BC St.'
    }
    setIsEditingMock = vi.fn()
    mockMutate = vi.fn()

    // 5. By default, spy on the hooks and return "happy-path" data
    vi.spyOn(
      OrganizationSnapshotHooks,
      'useOrganizationSnapshot'
    ).mockReturnValue({
      data: {},
      isLoading: false
    })
    vi.spyOn(
      OrganizationSnapshotHooks,
      'useUpdateOrganizationSnapshot'
    ).mockReturnValue({
      mutate: mockMutate,
      isLoading: false
    })
  })

  it('renders read-only data when not editing', () => {
    render(
      <OrganizationAddress
        snapshotData={snapshotData}
        complianceReportId={123}
        isEditing={false}
        setIsEditing={setIsEditingMock}
      />,
      { wrapper }
    )

    // Check read-only list items
    expect(screen.getByText('org:legalNameLabel:')).toBeInTheDocument()
    expect(screen.getByText(snapshotData.name)).toBeInTheDocument()
    expect(screen.getByText('org:operatingNameLabel:')).toBeInTheDocument()
    expect(screen.getByText(snapshotData.operatingName)).toBeInTheDocument()
  })

  it('renders the form in editing mode', () => {
    render(
      <OrganizationAddress
        snapshotData={snapshotData}
        complianceReportId={123}
        isEditing
        setIsEditing={setIsEditingMock}
      />,
      { wrapper }
    )

    // Expect form fields for editing
    expect(screen.getByLabelText('org:legalNameLabel')).toBeInTheDocument()
    expect(screen.getByLabelText('org:operatingNameLabel')).toBeInTheDocument()
    expect(screen.getByLabelText('org:phoneNbrLabel')).toBeInTheDocument()
  })

  it('calls mutate on form submit', async () => {
    render(
      <OrganizationAddress
        snapshotData={snapshotData}
        complianceReportId={1}
        isEditing
        setIsEditing={setIsEditingMock}
      />,
      { wrapper }
    )

    // Change phone
    const phoneInput = screen.getByLabelText('org:phoneNbrLabel')
    await userEvent.clear(phoneInput)
    await userEvent.type(phoneInput, '999-999-9999')

    // Submit the form
    const saveButton = screen.getByRole('button', { name: 'saveBtn' })
    await userEvent.click(saveButton)

    // Validate mutate call
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({
        ...snapshotData,
        phone: '999-999-9999'
      })
      expect(setIsEditingMock).toHaveBeenCalledWith(false)
    })
  })

  it('clicking Cancel resets data and exits edit mode', async () => {
    render(
      <OrganizationAddress
        snapshotData={snapshotData}
        complianceReportId={1}
        isEditing
        setIsEditing={setIsEditingMock}
      />,
      { wrapper }
    )

    // Change phone
    const phoneInput = screen.getByLabelText('org:phoneNbrLabel')
    await userEvent.clear(phoneInput)
    await userEvent.type(phoneInput, '999-999-9999')

    // Cancel
    const cancelButton = screen.getByRole('button', { name: 'cancelBtn' })
    await userEvent.click(cancelButton)

    // Make sure edit mode is off
    expect(setIsEditingMock).toHaveBeenCalledWith(false)
    // (We could confirm phoneInput is reset if the form remains mounted)
    expect(phoneInput.value).toBe(snapshotData.phone)
  })
})
