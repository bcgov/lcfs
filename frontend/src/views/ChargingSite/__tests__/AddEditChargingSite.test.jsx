import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AddEditChargingSite } from '../AddEditChargingSite'
import { wrapper } from '@/tests/utils/wrapper.jsx'

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
vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
  BCGridEditor: React.forwardRef((props, ref) => (
    <div data-testid="bc-grid-editor">
      <button onClick={() => props.onAddRows(1)}>Add Row</button>
      <button onClick={() => props.saveButtonProps?.onSave()}>Save</button>
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
  useGetIntendedUsers
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
    useGetIntendedUsers.mockReturnValue({
      data: [{ endUserTypeId: 1, typeName: 'Public' }],
      isLoading: false,
      isFetched: true
    })
    useSaveChargingSite.mockReturnValue({
      mutateAsync: vi.fn()
    })
  })

  it('renders add mode with correct title', () => {
    render(<AddEditChargingSite {...mockProps} />, { wrapper })
    expect(screen.getByText('chargingSite:addNewSite')).toBeInTheDocument()
    expect(
      screen.getByText('chargingSite:templateDescriptor')
    ).toBeInTheDocument()
  })

  it('renders edit mode with site name as title', () => {
    const editProps = {
      ...mockProps,
      isEditMode: true,
      data: { siteName: 'Test Site' }
    }
    render(<AddEditChargingSite {...editProps} />, { wrapper })
    expect(screen.getByText('Test Site')).toBeInTheDocument()
    expect(
      screen.queryByText('chargingSite:templateDescriptor')
    ).not.toBeInTheDocument()
  })

  it('renders grid editor', () => {
    render(<AddEditChargingSite {...mockProps} />, { wrapper })
    // Use getByText instead of getByTestId to avoid the selector issue
    expect(screen.getByText('Add Row')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
  })

  it('handles save button click', () => {
    render(<AddEditChargingSite {...mockProps} />, { wrapper })
    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)
    expect(mockNavigate).toHaveBeenCalled()
  })
})
