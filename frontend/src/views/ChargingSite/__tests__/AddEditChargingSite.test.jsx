import React from 'react'
import { describe, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { AddEditChargingSite } from '../AddEditChargingSite'
import { test } from '@/tests/utils/fixtures'
import ROUTES from '@/routes/routes'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null })
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'mock-token',
      authenticated: true
    }
  })
}))

vi.mock('@/services/useApiService', () => ({
  useApiService: () => ({
    apiRequest: vi.fn()
  })
}))

vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useChargingSite')
const mockHandleScheduleDelete = vi.fn()
const mockHandleScheduleSave = vi.fn()
vi.mock('@/utils/schedules', () => ({
  handleScheduleDelete: (...args) => mockHandleScheduleDelete(...args),
  handleScheduleSave: (...args) => mockHandleScheduleSave(...args)
}))
vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
  BCGridEditor: React.forwardRef((props, ref) => (
    <div data-testid="bc-grid-editor">
      <button onClick={() => props.onAddRows(1)}>Add Row</button>
      <button onClick={() => props.saveButtonProps?.onSave()}>Save</button>
      <button
        onClick={() =>
          props.onAction?.('delete', {
            node: { data: { chargingSiteId: 123 } },
            api: { isRowDataEmpty: () => false }
          })
        }
      >
        Delete
      </button>
      <button
        onClick={() =>
          props.onCellEditingStopped?.({
            oldValue: 'Old Allocating Org',
            newValue: '',
            node: {
              data: {
                chargingSiteId: 123,
                siteName: 'Site A',
                streetAddress: '1 Main St',
                city: 'Vancouver',
                postalCode: 'V6B 1A1',
                latitude: 49.28,
                longitude: -123.12,
                notes: '',
                allocatingOrganizationId: null,
                allocatingOrganizationName: '',
                status: { status: 'Draft' }
              },
              updateData: vi.fn()
            },
            api: { autoSizeAllColumns: vi.fn() }
          })
        }
      >
        Clear Allocating Org
      </button>
    </div>
  ))
}))

vi.mock('@/components/Role', () => ({
  Role: ({ children }) => <div>{children}</div>,
  __esModule: true
}))

vi.mock('@/components/ImportDialog', () => {
  const MockImportDialog = () => (
    <div data-testid="import-dialog">Import Dialog</div>
  )
  return {
    default: MockImportDialog,
    ImportDialog: MockImportDialog,
    __esModule: true
  }
})

import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useSaveChargingSite,
  useGetAllocationOrganizations
} from '@/hooks/useChargingSite'

describe('AddEditChargingSite', () => {
  const mockProps = {
    isEditMode: false,
    setIsEditMode: vi.fn(),
    data: null,
    refetch: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useCurrentUser.mockReturnValue({
      data: { organization: { organizationId: 1 } },
      isLoading: false,
      hasRoles: vi.fn(),
      hasAnyRole: vi.fn()
    })
    useGetAllocationOrganizations.mockReturnValue({
      data: [
        { organization_id: 1, name: 'Org 1' },
        { organization_id: 2, name: 'Org 2' }
      ],
      isLoading: false,
      isFetched: true
    })
    useSaveChargingSite.mockReturnValue({
      mutateAsync: vi.fn()
    })
    mockHandleScheduleDelete.mockResolvedValue(false)
    mockHandleScheduleSave.mockResolvedValue({
      validationStatus: 'success'
    })
  })

  test('renders add mode with correct title', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<AddEditChargingSite {...mockProps} />, [
      query,
      theme,
      localization,
      router
    ])
    expect(screen.getByText('chargingSite:addNewSite')).toBeInTheDocument()
    expect(
      screen.getByText('chargingSite:templateDescriptor')
    ).toBeInTheDocument()
  })

  test('renders edit mode with site name as title', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const editProps = {
      ...mockProps,
      isEditMode: true,
      data: { siteName: 'Test Site' }
    }
    render(<AddEditChargingSite {...editProps} />, [
      query,
      theme,
      localization,
      router
    ])
    expect(screen.getByText('Test Site')).toBeInTheDocument()
    expect(
      screen.queryByText('chargingSite:templateDescriptor')
    ).not.toBeInTheDocument()
  })

  test('renders grid editor', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<AddEditChargingSite {...mockProps} />, [
      query,
      theme,
      localization,
      router
    ])
    // Use getByText instead of getByTestId to avoid the selector issue
    expect(screen.getByText('Add Row')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
  })

  test('handles save button click', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<AddEditChargingSite {...mockProps} />, [
      query,
      theme,
      localization,
      router
    ])
    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)
    expect(mockNavigate).toHaveBeenCalled()
  })

  test('does not navigate away after deleting from add page', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockHandleScheduleDelete.mockResolvedValue(true)
    render(<AddEditChargingSite {...mockProps} />, [
      query,
      theme,
      localization,
      router
    ])

    const deleteButton = screen.getByText('Delete')
    fireEvent.click(deleteButton)

    await waitFor(() => expect(mockHandleScheduleDelete).toHaveBeenCalled())
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  test('navigates to index after deleting an existing charging site', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockHandleScheduleDelete.mockResolvedValue(true)
    render(
      <AddEditChargingSite
        {...mockProps}
        isEditMode={true}
        data={{ chargingSiteId: 123, siteName: 'To Delete' }}
      />,
      [query, theme, localization, router]
    )

    const deleteButton = screen.getByText('Delete')
    fireEvent.click(deleteButton)

    await waitFor(() => expect(mockHandleScheduleDelete).toHaveBeenCalled())
    expect(mockNavigate).toHaveBeenCalledWith(
      ROUTES.REPORTS.CHARGING_SITE.INDEX,
      expect.objectContaining({
        replace: true,
        state: expect.objectContaining({
          severity: 'success'
        })
      })
    )
  })

  test('sends a cleared allocating organization as explicit nulls', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    // The backend treats a missing key as "unchanged", so clearing the field
    // must reach it as null rather than being stripped with the other blanks.
    render(
      <AddEditChargingSite
        {...mockProps}
        isEditMode={true}
        data={{ chargingSiteId: 123, siteName: 'Site A' }}
      />,
      [query, theme, localization, router]
    )

    fireEvent.click(screen.getByText('Clear Allocating Org'))

    await waitFor(() => expect(mockHandleScheduleSave).toHaveBeenCalled())
    const { updatedData } = mockHandleScheduleSave.mock.calls[0][0]
    expect(updatedData.allocatingOrganizationId).toBeNull()
    expect(updatedData.allocatingOrganizationName).toBeNull()
    expect(updatedData).toHaveProperty('allocatingOrganizationName')
    // Other blank fields are still dropped from the payload.
    expect(updatedData).not.toHaveProperty('notes')
    expect(updatedData.siteName).toBe('Site A')
  })
})
