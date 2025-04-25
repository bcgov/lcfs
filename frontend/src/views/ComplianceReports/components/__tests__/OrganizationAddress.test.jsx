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
      recordsAddress: '456 BC St.',
      headOfficeAddress: '789 HQ St.'
    }

    setIsEditingMock = vi.fn()
    mockMutate = vi.fn()

    // 5. By default, spy on the hooks and return "happy-path" data
    vi.spyOn(
      OrganizationSnapshotHooks,
      'useOrganizationSnapshot'
    ).mockReturnValue({
      data: snapshotData,
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
    expect(screen.getByText('org:phoneNbrLabel:')).toBeInTheDocument()
    expect(screen.getByText(snapshotData.phone)).toBeInTheDocument()
  })

  it('renders the form in editing mode', async () => {
    render(
      <OrganizationAddress
        snapshotData={snapshotData}
        complianceReportId={123}
        isEditing={true}
        setIsEditing={setIsEditingMock}
      />,
      { wrapper }
    )

    // Use getByRole with name to find inputs
    expect(
      screen.getByRole('textbox', { name: /org:legalNameLabel/i })
    ).toHaveValue(snapshotData.name)
    expect(
      screen.getByRole('textbox', { name: /org:operatingNameLabel/i })
    ).toHaveValue(snapshotData.operatingName)
    expect(
      screen.getByRole('textbox', { name: /org:phoneNbrLabel/i })
    ).toHaveValue(snapshotData.phone)
  })

  it('calls mutate on form submit with valid data', async () => {
    const user = userEvent.setup()

    render(
      <OrganizationAddress
        snapshotData={snapshotData}
        complianceReportId={1}
        isEditing={true}
        setIsEditing={setIsEditingMock}
      />,
      { wrapper }
    )

    // Update phone with valid format using getByRole
    const phoneInput = screen.getByRole('textbox', {
      name: /org:phoneNbrLabel/i
    })
    await user.clear(phoneInput)
    await user.type(phoneInput, '999-999-9999')

    // Submit form
    const saveButton = screen.getByRole('button', { name: 'saveBtn' })
    await user.click(saveButton)

    // Validate mutate call
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({
        ...snapshotData,
        phone: '999-999-9999'
      })
      expect(setIsEditingMock).toHaveBeenCalledWith(false)
    })
  })

  it('shows validation errors for invalid data', async () => {
    const user = userEvent.setup()

    render(
      <OrganizationAddress
        snapshotData={snapshotData}
        complianceReportId={1}
        isEditing={true}
        setIsEditing={setIsEditingMock}
      />,
      { wrapper }
    )

    // Enter invalid phone number using getByRole
    const phoneInput = screen.getByRole('textbox', {
      name: /org:phoneNbrLabel/i
    })
    await user.clear(phoneInput)
    await user.type(phoneInput, '123') // Invalid format

    // Submit form
    const saveButton = screen.getByRole('button', { name: 'saveBtn' })
    await user.click(saveButton)

    // Check validation error
    expect(
      await screen.findByText('Phone number is not valid')
    ).toBeInTheDocument()
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('clicking Cancel resets form and exits edit mode', async () => {
    const user = userEvent.setup()

    render(
      <OrganizationAddress
        snapshotData={snapshotData}
        complianceReportId={1}
        isEditing={true}
        setIsEditing={setIsEditingMock}
      />,
      { wrapper }
    )

    // Change form values using getByRole
    const phoneInput = screen.getByRole('textbox', {
      name: /org:phoneNbrLabel/i
    })
    await user.clear(phoneInput)
    await user.type(phoneInput, '999-999-9999')

    // Click cancel
    const cancelButton = screen.getByRole('button', { name: 'cancelBtn' })
    await user.click(cancelButton)

    // Verify reset and edit mode exit
    expect(setIsEditingMock).toHaveBeenCalledWith(false)
    expect(phoneInput).toHaveValue(snapshotData.phone)
  })

  it('does not display "Required" for headOfficeAddress or recordsAddress when empty in read-only mode', () => {
    const emptySnapshotData = {
      ...snapshotData,
      headOfficeAddress: '',
      recordsAddress: '' // both optional fields empty
    }

    render(
      <OrganizationAddress
        snapshotData={emptySnapshotData}
        complianceReportId={123}
        isEditing={false}
        setIsEditing={setIsEditingMock}
      />,
      { wrapper }
    )

    // The read-only label is visible
    expect(screen.getByText('report:hoAddrLabelView:')).toBeInTheDocument()
    // The field is empty, so check that "Required" is NOT displayed
    expect(screen.queryByText('Required')).not.toBeInTheDocument()

    // The same check applies to the records address label:
    expect(screen.getByText('report:orgDetailsForm.bcRecordLabel:')).toBeInTheDocument()
    // No "Required" label for empty optional address
    expect(screen.queryByText('Required')).not.toBeInTheDocument()
  })
})
