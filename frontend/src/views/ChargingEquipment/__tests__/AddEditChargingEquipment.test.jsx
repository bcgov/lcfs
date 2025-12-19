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

    expect(
      getNextRegistrationNumber('ABC-0003', existingRows)
    ).toBe('ABC-0006')
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
})
