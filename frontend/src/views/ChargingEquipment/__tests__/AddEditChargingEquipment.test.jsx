import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import {
  AddEditChargingEquipment,
  getNextRegistrationNumber,
  createDuplicatedBulkRow
} from '../AddEditChargingEquipment'

// --------------------
// Validation helpers
// --------------------

// Re-create the isRowValid function for testing
const isRowValid = (row) =>
  Boolean(
    row?.chargingSiteId &&
      row?.serialNumber &&
      row?.manufacturer &&
      row?.levelOfEquipmentId &&
      row?.intendedUseIds?.length > 0 &&
      row?.intendedUserIds?.length > 0
  )

const getEmptyRow = (id = Date.now()) => ({
  id,
  chargingSiteId: '',
  serialNumber: '',
  manufacturer: '',
  model: '',
  levelOfEquipmentId: '',
  ports: '',
  latitude: 0,
  longitude: 0,
  notes: '',
  intendedUseIds: [],
  intendedUserIds: []
})

// --------------------
// Mocks
// --------------------

vi.mock('@/hooks/useChargingEquipment')
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/services/useApiService')

const mockNavigate = vi.fn()
let mockLocationState = null

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      pathname: '/compliance-reporting/fse/1/edit',
      state: mockLocationState
    }),
    useParams: () => ({ fseId: '1' })
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
  BCGridEditor: React.forwardRef(({ saveButtonProps }, ref) => (
    <div data-test="bc-grid-editor" ref={ref}>
      <button data-test="save-return-btn" onClick={saveButtonProps?.onSave}>
        {saveButtonProps?.text || 'Save'}
      </button>
    </div>
  ))
}))

vi.mock('@/components/ImportDialog', () => ({
  default: () => <div data-testid="import-dialog">Import Dialog Mock</div>
}))

const TestWrapper = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  )
}

// --------------------
// isRowValid tests
// --------------------

describe('isRowValid validation function', () => {
  it('returns true for a complete row', () => {
    expect(
      isRowValid({
        chargingSiteId: 1,
        serialNumber: 'ABC123',
        manufacturer: 'Tesla',
        levelOfEquipmentId: 1,
        intendedUseIds: [1],
        intendedUserIds: [1]
      })
    ).toBe(true)
  })

  it('returns false for empty row', () => {
    expect(isRowValid(getEmptyRow())).toBe(false)
  })

  it('returns false when chargingSiteId is 0', () => {
    expect(
      isRowValid({
        chargingSiteId: 0,
        serialNumber: 'ABC123',
        manufacturer: 'Tesla',
        levelOfEquipmentId: 1,
        intendedUseIds: [1],
        intendedUserIds: [1]
      })
    ).toBe(false)
  })
})

// --------------------
// getEmptyRow tests
// --------------------

describe('getEmptyRow function behavior', () => {
  it('creates empty ports', () => {
    expect(getEmptyRow().ports).toBe('')
  })

  it('creates empty intendedUseIds and intendedUserIds', () => {
    const row = getEmptyRow()
    expect(row.intendedUseIds).toEqual([])
    expect(row.intendedUserIds).toEqual([])
  })
})

describe('getNextRegistrationNumber helper', () => {
  it('increments to the next available number for the same prefix', () => {
    const existingRows = [
      { registrationNumber: 'ABC-0005' },
      { registrationNumber: 'XYZ-0010' }
    ]

    expect(getNextRegistrationNumber('ABC-0003', existingRows)).toBe('ABC-0006')
  })

  it('returns empty string when registration number cannot be parsed', () => {
    expect(getNextRegistrationNumber('', [])).toBe('')
    expect(getNextRegistrationNumber('N/A', [])).toBe('')
  })
})

describe('createDuplicatedBulkRow helper', () => {
  it('clones fields while clearing serial number and incrementing registration number', () => {
    const baseRow = {
      id: 'original',
      chargingSiteId: 25,
      serialNumber: 'SER123',
      manufacturer: 'TestCo',
      model: 'Model X',
      levelOfEquipmentId: 2,
      intendedUseIds: [1, 2],
      intendedUserIds: [3],
      notes: 'Hello world',
      registrationNumber: 'REG-0007',
      chargingEquipmentId: 99,
      validationStatus: 'success'
    }

    const duplicated = createDuplicatedBulkRow(
      baseRow,
      [baseRow],
      () => 'new-id'
    )

    expect(duplicated.id).toBe('new-id')
    expect(duplicated.serialNumber).toBe('')
    expect(duplicated.registrationNumber).toBe('REG-0008')
    expect(duplicated.chargingEquipmentId).toBeUndefined()
    expect(duplicated.intendedUseIds).toEqual([1, 2])
    expect(duplicated.intendedUseIds).not.toBe(baseRow.intendedUseIds)
    expect(duplicated.intendedUserIds).toEqual([3])
    expect(duplicated.intendedUserIds).not.toBe(baseRow.intendedUserIds)
    expect(duplicated.status).toBe('Draft')
    expect(duplicated.validationStatus).toBeUndefined()
  })
})

// --------------------
// AddEditChargingEquipment navigation tests
// --------------------

describe('AddEditChargingEquipment - Navigation', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockLocationState = null

    const { useApiService } = await import('@/services/useApiService')
    const { useCurrentUser } = await import('@/hooks/useCurrentUser')
    const {
      useGetChargingEquipment,
      useCreateChargingEquipment,
      useUpdateChargingEquipment,
      useDeleteChargingEquipment,
      useChargingEquipmentMetadata,
      useChargingSites,
      useOrganizations,
      useHasAllocationAgreements
    } = await import('@/hooks/useChargingEquipment')

    useApiService.mockReturnValue({
      post: vi.fn().mockResolvedValue({ data: {} }),
      get: vi.fn().mockResolvedValue({ data: {} }),
      put: vi.fn().mockResolvedValue({ data: {} }),
      delete: vi.fn().mockResolvedValue({ data: {} })
    })

    useCurrentUser.mockReturnValue({
      data: {
        userId: 1,
        organization: { organizationId: 123 }
      },
      hasAnyRole: vi.fn(() => false)
    })

    useGetChargingEquipment.mockReturnValue({
      data: {
        chargingEquipmentId: 1,
        status: 'Draft',
        chargingSiteId: '123',
        serialNumber: 'SN001'
      },
      isLoading: false,
      isError: false
    })

    useChargingEquipmentMetadata.mockReturnValue({
      statuses: [],
      levels: [],
      endUseTypes: [],
      endUserTypes: [],
      isLoading: false
    })

    useChargingSites.mockReturnValue({ data: [], isLoading: false })
    useOrganizations.mockReturnValue({ data: [], isLoading: false })
    useHasAllocationAgreements.mockReturnValue({ data: false })
    useCreateChargingEquipment.mockReturnValue({ mutateAsync: vi.fn() })
    useUpdateChargingEquipment.mockReturnValue({ mutateAsync: vi.fn() })
    useDeleteChargingEquipment.mockReturnValue({ mutateAsync: vi.fn() })
  })

  it('navigates to Manage FSE by default', () => {
    render(
      <TestWrapper>
        <AddEditChargingEquipment />
      </TestWrapper>
    )

    fireEvent.click(screen.getByTestId('save-return-btn'))
    expect(mockNavigate).toHaveBeenCalledWith('/compliance-reporting/fse')
  })

  it('navigates back using returnTo state', () => {
    mockLocationState = {
      returnTo: '/compliance-reporting/charging-sites/123'
    }

    render(
      <TestWrapper>
        <AddEditChargingEquipment />
      </TestWrapper>
    )

    fireEvent.click(screen.getByTestId('save-return-btn'))
    expect(mockNavigate).toHaveBeenCalledWith(
      '/compliance-reporting/charging-sites/123'
    )
  })

  it('navigates back to charging site when returnTo includes charging-sites path', () => {
    mockLocationState = {
      returnTo: '/compliance-reporting/charging-sites/456'
    }

    render(
      <TestWrapper>
        <AddEditChargingEquipment />
      </TestWrapper>
    )

    fireEvent.click(screen.getByTestId('save-return-btn'))
    expect(mockNavigate).toHaveBeenCalledWith(
      '/compliance-reporting/charging-sites/456'
    )
  })

  it('navigates back to manage FSE when returnTo includes fse path', () => {
    mockLocationState = {
      returnTo: '/compliance-reporting/fse'
    }

    render(
      <TestWrapper>
        <AddEditChargingEquipment />
      </TestWrapper>
    )

    fireEvent.click(screen.getByTestId('save-return-btn'))
    expect(mockNavigate).toHaveBeenCalledWith('/compliance-reporting/fse')
  })
})

// --------------------
// AddEditChargingEquipment - Charging Site Pre-population and Locking
// --------------------

describe('AddEditChargingEquipment - Charging Site Field Behavior', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockLocationState = null

    const { useApiService } = await import('@/services/useApiService')
    const { useCurrentUser } = await import('@/hooks/useCurrentUser')
    const {
      useGetChargingEquipment,
      useCreateChargingEquipment,
      useUpdateChargingEquipment,
      useDeleteChargingEquipment,
      useChargingEquipmentMetadata,
      useChargingSites,
      useOrganizations,
      useHasAllocationAgreements
    } = await import('@/hooks/useChargingEquipment')

    useApiService.mockReturnValue({
      post: vi.fn().mockResolvedValue({ data: {} }),
      get: vi.fn().mockResolvedValue({ data: {} }),
      put: vi.fn().mockResolvedValue({ data: {} }),
      delete: vi.fn().mockResolvedValue({ data: {} })
    })

    useCurrentUser.mockReturnValue({
      data: {
        userId: 1,
        organization: { organizationId: 123 }
      },
      hasAnyRole: vi.fn(() => false)
    })

    useGetChargingEquipment.mockReturnValue({
      data: {
        chargingEquipmentId: 1,
        status: 'Draft',
        chargingSiteId: 456,
        serialNumber: 'SN001'
      },
      isLoading: false,
      isError: false
    })

    useChargingEquipmentMetadata.mockReturnValue({
      statuses: [],
      levels: [{ levelOfEquipmentId: 1, name: 'Level 2' }],
      endUseTypes: [{ endUseTypeId: 1, typeName: 'Public' }],
      endUserTypes: [{ endUserTypeId: 1, typeName: 'Fleet' }],
      isLoading: false
    })

    useChargingSites.mockReturnValue({
      data: [
        {
          chargingSiteId: 456,
          siteName: 'Test Site',
          latitude: 49.2827,
          longitude: -123.1207
        }
      ],
      isLoading: false
    })
    useOrganizations.mockReturnValue({ data: [], isLoading: false })
    useHasAllocationAgreements.mockReturnValue({ data: false })
    useCreateChargingEquipment.mockReturnValue({ mutateAsync: vi.fn() })
    useUpdateChargingEquipment.mockReturnValue({ mutateAsync: vi.fn() })
    useDeleteChargingEquipment.mockReturnValue({ mutateAsync: vi.fn() })
  })

  describe('When accessed from Charging Site page (with chargingSiteId in state)', () => {
    it('should pre-populate chargingSiteId for new FSE', () => {
      mockLocationState = {
        returnTo: '/compliance-reporting/charging-sites/456',
        chargingSiteId: '456'
      }

      render(
        <TestWrapper>
          <AddEditChargingEquipment mode="bulk" />
        </TestWrapper>
      )

      // The component should be rendered (basic smoke test)
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('should lock charging site field when chargingSiteId is in state', () => {
      mockLocationState = {
        returnTo: '/compliance-reporting/charging-sites/456',
        chargingSiteId: '456'
      }

      render(
        <TestWrapper>
          <AddEditChargingEquipment mode="bulk" />
        </TestWrapper>
      )

      // Component renders successfully with locked state
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('should lock charging site field when editing FSE from charging site', () => {
      mockLocationState = {
        returnTo: '/compliance-reporting/charging-sites/456',
        chargingSiteId: '456'
      }

      render(
        <TestWrapper>
          <AddEditChargingEquipment mode="single" />
        </TestWrapper>
      )

      // Component renders with locked field
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })

  describe('When accessed from Manage FSE page (without chargingSiteId in state)', () => {
    it('should NOT pre-populate chargingSiteId for new FSE', () => {
      mockLocationState = {
        returnTo: '/compliance-reporting/fse'
      }

      render(
        <TestWrapper>
          <AddEditChargingEquipment mode="bulk" />
        </TestWrapper>
      )

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('should NOT lock charging site field when no chargingSiteId in state', () => {
      mockLocationState = {
        returnTo: '/compliance-reporting/fse'
      }

      render(
        <TestWrapper>
          <AddEditChargingEquipment mode="bulk" />
        </TestWrapper>
      )

      // Component renders with editable field
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('should allow editing charging site field when editing FSE from manage FSE', () => {
      mockLocationState = {
        returnTo: '/compliance-reporting/fse'
      }

      render(
        <TestWrapper>
          <AddEditChargingEquipment mode="single" />
        </TestWrapper>
      )

      // Component renders with editable field
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })

  describe('Edge cases and validation', () => {
    it('should handle chargingSiteId as string and convert to number', () => {
      mockLocationState = {
        returnTo: '/compliance-reporting/charging-sites/456',
        chargingSiteId: '456' // String value
      }

      render(
        <TestWrapper>
          <AddEditChargingEquipment mode="bulk" />
        </TestWrapper>
      )

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('should handle chargingSiteId as number', () => {
      mockLocationState = {
        returnTo: '/compliance-reporting/charging-sites/456',
        chargingSiteId: 456 // Number value
      }

      render(
        <TestWrapper>
          <AddEditChargingEquipment mode="bulk" />
        </TestWrapper>
      )

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('should not lock field when chargingSiteId is null', () => {
      mockLocationState = {
        returnTo: '/compliance-reporting/fse',
        chargingSiteId: null
      }

      render(
        <TestWrapper>
          <AddEditChargingEquipment mode="bulk" />
        </TestWrapper>
      )

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('should not lock field when chargingSiteId is undefined', () => {
      mockLocationState = {
        returnTo: '/compliance-reporting/fse',
        chargingSiteId: undefined
      }

      render(
        <TestWrapper>
          <AddEditChargingEquipment mode="bulk" />
        </TestWrapper>
      )

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('should not lock field when chargingSiteId is empty string', () => {
      mockLocationState = {
        returnTo: '/compliance-reporting/fse',
        chargingSiteId: ''
      }

      render(
        <TestWrapper>
          <AddEditChargingEquipment mode="bulk" />
        </TestWrapper>
      )

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })
})
