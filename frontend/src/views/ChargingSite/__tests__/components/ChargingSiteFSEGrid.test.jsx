import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChargingSiteFSEGrid } from '../../components/ChargingSiteFSEGrid'
import { wrapper } from '@/tests/utils/wrapper.jsx'

const mockNavigate = vi.fn()
const mockPathname = '/compliance-reporting/charging-sites/123'

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
    <div data-testid="bc-grid-viewer">
      <button
        onClick={() =>
          props.onCellClicked({ data: { chargingEquipmentId: 456 } })
        }
      >
        Row Click
      </button>
    </div>
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
      const idirProps = { ...mockProps, isIDIR: true }
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
            chargingSiteId: '123'
          }
        }
      )
    })

    it('includes correct siteId from useParams in navigation state', () => {
      render(<ChargingSiteFSEGrid {...mockProps} />, { wrapper })

      const newFSEButton = screen.getByText('chargingSite:buttons.newFSE')
      fireEvent.click(newFSEButton)

      const navigationCall = mockNavigate.mock.calls[0]
      expect(navigationCall[1].state.chargingSiteId).toBe('123')
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
            chargingSiteId: '123'
          })
        })
      )
    })

    it('maintains consistent siteId across multiple navigations', () => {
      render(<ChargingSiteFSEGrid {...mockProps} />, { wrapper })

      // Navigate to new FSE
      const newFSEButton = screen.getByText('chargingSite:buttons.newFSE')
      fireEvent.click(newFSEButton)

      const firstCall = mockNavigate.mock.calls[0]
      expect(firstCall[1].state.chargingSiteId).toBe('123')

      // Navigate to edit FSE
      const rowButton = screen.getByText('Row Click')
      fireEvent.click(rowButton)

      const secondCall = mockNavigate.mock.calls[1]
      expect(secondCall[1].state.chargingSiteId).toBe('123')

      // Both should have the same siteId
      expect(firstCall[1].state.chargingSiteId).toBe(
        secondCall[1].state.chargingSiteId
      )
    })
  })
})
