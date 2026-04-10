import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChargingSiteFSEGrid } from '../../components/ChargingSiteFSEGrid'
import { wrapper } from '@/tests/utils/wrapper.jsx'

const mockNavigate = vi.fn()
const mockPathname = '/compliance-reporting/charging-sites/123'
let lastGridProps

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
  useParams: () => ({ siteId: '123' })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/hooks/useChargingSite')
vi.mock('@/components/BCDataGrid/BCGridViewer.jsx', () => ({
  BCGridViewer: React.forwardRef((props, ref) => (
    (lastGridProps = props,
    <div data-testid="bc-grid-viewer">
      <button
        onClick={() =>
          props.onCellClicked?.({ data: { chargingEquipmentId: 456 } })
        }
      >
        Row Click
      </button>
      <button
        onClick={() =>
          props.gridOptions?.onSelectionChanged?.({
            api: {
              getSelectedNodes: () => [
                { data: { chargingEquipmentId: 2, status: { status: 'Validated' } } }
              ]
            }
          })
        }
      >
        Select Validated
      </button>
      <button
        onClick={() =>
          props.gridOptions?.onSelectionChanged?.({
            api: {
              getSelectedNodes: () => [
                { data: { chargingEquipmentId: 3, status: { status: 'Submitted' } } }
              ]
            }
          })
        }
      >
        Select Submitted
      </button>
    </div>)
  ))
}))

vi.mock('@/components/BCAlert', () => ({
  BCAlert2: React.forwardRef((props, ref) => (
    <div data-testid="bc-alert">Alert</div>
  ))
}))

import {
  useChargingSiteEquipmentPaginated,
  useBulkUpdateEquipmentStatus
} from '@/hooks/useChargingSite'

describe('ChargingSiteFSEGrid', () => {
  const mockEquipmentData = {
    equipments: [
      {
        chargingEquipmentId: 1,
        status: { status: 'Draft' },
        registrationNumber: 'REG001'
      },
      {
        chargingEquipmentId: 2,
        status: { status: 'Validated' },
        registrationNumber: 'REG002'
      },
      {
        chargingEquipmentId: 3,
        status: { status: 'Submitted' },
        registrationNumber: 'REG003'
      }
    ],
    status: { status: 'Draft' },
    organizationId: 1
  }

  const mockProps = {
    hasAnyRole: vi.fn(),
    hasRoles: vi.fn(),
    isIDIR: false,
    currentUser: { userId: 1 }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    lastGridProps = null
    useChargingSiteEquipmentPaginated.mockReturnValue({
      data: mockEquipmentData,
      isLoading: false,
      refetch: vi.fn()
    })
    useBulkUpdateEquipmentStatus.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false
    })
  })

  it('renders grid with equipment data', () => {
    render(<ChargingSiteFSEGrid {...mockProps} />, { wrapper })

    expect(screen.getByText('gridTitle')).toBeInTheDocument()
    expect(screen.getByText('gridDescription')).toBeInTheDocument()
    expect(screen.getByText('Row Click')).toBeInTheDocument()
  })

  it('uses a single built-in selection column instead of schema checkbox column', () => {
    render(<ChargingSiteFSEGrid {...mockProps} />, { wrapper })

    const selectColumn = lastGridProps.columnDefs.find(
      (col) => col.field === '__select__'
    )
    expect(selectColumn).toBeUndefined()
    expect(lastGridProps.gridOptions.selectionColumnDef).toBeDefined()
  })

  it('renders IDIR view for government users', () => {
    const idirProps = { ...mockProps, isIDIR: true }
    render(<ChargingSiteFSEGrid {...idirProps} />, { wrapper })

    expect(screen.getByText('equipmentProcessingTitle')).toBeInTheDocument()
    expect(
      screen.getByText('equipmentProcessingDescription')
    ).toBeInTheDocument()
  })

  it('handles row click navigation with returnTo state and chargingSiteId', () => {
    render(<ChargingSiteFSEGrid {...mockProps} />, { wrapper })

    const rowButton = screen.getByText('Row Click')
    fireEvent.click(rowButton)

    expect(mockNavigate).toHaveBeenCalledWith(
      '/compliance-reporting/fse/456/edit',
      {
        state: { 
          returnTo: mockPathname,
          chargingSiteId: '123' // Should include siteId for locking
        }
      }
    )
  })

  it('displays loading state', () => {
    useChargingSiteEquipmentPaginated.mockReturnValue({
      data: null,
      isLoading: true,
      refetch: vi.fn()
    })

    render(<ChargingSiteFSEGrid {...mockProps} />, { wrapper })
    expect(screen.getByText('Row Click')).toBeInTheDocument()
  })

  describe('New FSE Button', () => {
    it('renders New FSE button for BCeID users', () => {
      render(<ChargingSiteFSEGrid {...mockProps} />, { wrapper })

      const newFSEButton = screen.getByText('chargingSite:buttons.newFSE')
      expect(newFSEButton).toBeInTheDocument()
    })

    it('does not render New FSE button for IDIR users', () => {
      const idirProps = {
        ...mockProps,
        isIDIR: true,
        hasAnyRole: vi.fn(() => true) // IDIR users have government roles
      }
      render(<ChargingSiteFSEGrid {...idirProps} />, { wrapper })

      const newFSEButton = screen.queryByText('chargingSite:buttons.newFSE')
      expect(newFSEButton).not.toBeInTheDocument()
    })

    it('navigates to bulk FSE add page with returnTo and chargingSiteId', () => {
      render(<ChargingSiteFSEGrid {...mockProps} />, { wrapper })

      const newFSEButton = screen.getByText('chargingSite:buttons.newFSE')
      fireEvent.click(newFSEButton)

      expect(mockNavigate).toHaveBeenCalledWith(
        '/compliance-reporting/fse/add',
        {
          state: {
            returnTo: mockPathname,
            chargingSiteId: 123 // parseInt converts string to number
          }
        }
      )
    })

    it('includes correct siteId from useParams in navigation state', () => {
      render(<ChargingSiteFSEGrid {...mockProps} />, { wrapper })

      const newFSEButton = screen.getByText('chargingSite:buttons.newFSE')
      fireEvent.click(newFSEButton)

      const navigationCall = mockNavigate.mock.calls[0]
      expect(navigationCall[1].state.chargingSiteId).toBe(123) // parseInt converts string to number
    })
  })

  describe('Navigation State Management', () => {
    it('passes chargingSiteId when editing FSE from charging site', () => {
      render(<ChargingSiteFSEGrid {...mockProps} />, { wrapper })

      const rowButton = screen.getByText('Row Click')
      fireEvent.click(rowButton)

      const navigationCall = mockNavigate.mock.calls[0]
      expect(navigationCall[0]).toBe('/compliance-reporting/fse/456/edit')
      expect(navigationCall[1].state).toEqual({
        returnTo: mockPathname,
        chargingSiteId: '123'
      })
    })

    it('preserves current pathname in returnTo state', () => {
      render(<ChargingSiteFSEGrid {...mockProps} />, { wrapper })

      const newFSEButton = screen.getByText('chargingSite:buttons.newFSE')
      fireEvent.click(newFSEButton)

      const navigationCall = mockNavigate.mock.calls[0]
      expect(navigationCall[1].state.returnTo).toBe(mockPathname)
    })

    it('does not navigate when IDIR user clicks row', () => {
      const idirProps = { ...mockProps, isIDIR: true }
      render(<ChargingSiteFSEGrid {...idirProps} />, { wrapper })

      const rowButton = screen.getByText('Row Click')
      fireEvent.click(rowButton)

      // IDIR users should not navigate when clicking rows
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe('Integration with Charging Site Context', () => {
    it('uses siteId from URL params for all navigation', () => {
      render(<ChargingSiteFSEGrid {...mockProps} />, { wrapper })

      // Test New FSE navigation
      const newFSEButton = screen.getByText('chargingSite:buttons.newFSE')
      fireEvent.click(newFSEButton)

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          state: expect.objectContaining({
            chargingSiteId: 123 // parseInt converts string to number
          })
        })
      )
    })

    it('maintains consistent siteId across multiple navigations', () => {
      render(<ChargingSiteFSEGrid {...mockProps} />, { wrapper })

      // Navigate to new FSE (uses parseInt, so number)
      const newFSEButton = screen.getByText('chargingSite:buttons.newFSE')
      fireEvent.click(newFSEButton)

      const firstCall = mockNavigate.mock.calls[0]
      expect(firstCall[1].state.chargingSiteId).toBe(123)

      // Navigate to edit FSE (keeps as string)
      const rowButton = screen.getByText('Row Click')
      fireEvent.click(rowButton)

      const secondCall = mockNavigate.mock.calls[1]
      expect(secondCall[1].state.chargingSiteId).toBe('123')

      // Note: The types differ (number vs string) but represent the same value
      expect(String(firstCall[1].state.chargingSiteId)).toBe(
        String(secondCall[1].state.chargingSiteId)
      )
    })
  })

  describe('Return to draft button rules', () => {
    it('disables Return to draft for IDIR when a Validated row is selected', async () => {
      const idirProps = {
        ...mockProps,
        isIDIR: true,
        hasAnyRole: vi.fn(() => true),
        hasRoles: vi.fn((role) => role === 'analyst')
      }
      render(<ChargingSiteFSEGrid {...idirProps} />, { wrapper })

      fireEvent.click(screen.getByText('Select Validated'))

      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: 'chargingSite:buttons.returnSelectedToDraft'
          })
        ).toBeDisabled()
      })
    })

    it('keeps Return to draft enabled for non-IDIR when a Validated row is selected', async () => {
      render(<ChargingSiteFSEGrid {...mockProps} />, { wrapper })

      fireEvent.click(screen.getByText('Select Validated'))

      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: 'chargingSite:buttons.returnSelectedToDraft'
          })
        ).toBeEnabled()
      })
    })
  })

  describe('history mode', () => {
    it('renders read-only history view without processing actions or row navigation', () => {
      const historyData = {
        equipments: [
          {
            chargingEquipmentId: 10,
            registrationNumber: 'REG001',
            version: 3,
            status: { status: 'Validated' },
            complianceYears: ['2024']
          },
          {
            chargingEquipmentId: 9,
            registrationNumber: 'REG001',
            version: 2,
            status: { status: 'Submitted' },
            complianceYears: ['2023']
          }
        ],
        pagination: { total: 2, page: 1, size: 25, totalPages: 1 }
      }
      useChargingSiteEquipmentPaginated.mockReturnValue({
        data: historyData,
        isLoading: false,
        refetch: vi.fn()
      })

      render(<ChargingSiteFSEGrid {...mockProps} historyMode />, { wrapper })

      expect(screen.getByText('historyGridTitle')).toBeInTheDocument()
      expect(screen.getByText('historyGridDescription')).toBeInTheDocument()
      expect(screen.queryByText('chargingSite:buttons.newFSE')).not.toBeInTheDocument()
      expect(lastGridProps.onCellClicked).toBeUndefined()
      expect(
        lastGridProps.columnDefs.some((col) => col.field === '__historyToggle__')
      ).toBe(true)
    })

    it('shows only the current version by default and expands older versions inline', async () => {
      const historyData = {
        equipments: [
          {
            chargingEquipmentId: 10,
            registrationNumber: 'REG001',
            version: 3,
            status: { status: 'Validated' },
            manufacturer: 'Current Co',
            complianceYears: ['2024']
          },
          {
            chargingEquipmentId: 9,
            registrationNumber: 'REG001',
            version: 2,
            status: { status: 'Submitted' },
            manufacturer: 'Older Co',
            complianceYears: ['2023']
          },
          {
            chargingEquipmentId: 8,
            registrationNumber: 'REG002',
            version: 1,
            status: { status: 'Draft' },
            manufacturer: 'Solo Co',
            complianceYears: []
          }
        ],
        pagination: { total: 3, page: 1, size: 25, totalPages: 1 }
      }
      useChargingSiteEquipmentPaginated.mockReturnValue({
        data: historyData,
        isLoading: false,
        refetch: vi.fn()
      })

      render(<ChargingSiteFSEGrid {...mockProps} historyMode />, { wrapper })

      expect(lastGridProps.queryData.equipments).toHaveLength(2)
      expect(lastGridProps.queryData.equipments[0]).toMatchObject({
        registrationNumber: 'REG001',
        version: 3,
        isCurrentVersionRow: true,
        hasHistory: true,
        isExpanded: false
      })

      const toggleColumn = lastGridProps.columnDefs.find(
        (col) => col.field === '__historyToggle__'
      )
      const toggleButton = render(
        toggleColumn.cellRenderer({
          data: lastGridProps.queryData.equipments[0]
        })
      ).getByRole('button', {
        name: 'chargingSite:buttons.expandHistory'
      })

      fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(lastGridProps.queryData.equipments).toHaveLength(3)
      })

      expect(lastGridProps.queryData.equipments[1]).toMatchObject({
        registrationNumber: 'REG001',
        version: 2,
        isHistoryVersion: true,
        actionType: 'UPDATE',
        diff: expect.arrayContaining([
          'status',
          'version',
          'manufacturer',
          'complianceYears'
        ])
      })
    })
  })
})
