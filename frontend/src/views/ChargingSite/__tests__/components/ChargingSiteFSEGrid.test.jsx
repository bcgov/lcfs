import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

vi.mock('@/components/BCButton', () => ({
  __esModule: true,
  default: ({
    children,
    onClick,
    startIcon,
    fullWidth,
    ...props
  }) => (
    <button
      type="button"
      onClick={onClick}
      data-full-width={fullWidth ? 'true' : undefined}
      {...props}
    >
      {startIcon}
      {children}
    </button>
  )
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

  it('handles row click navigation with returnTo state and chargingSiteId', () => {
    render(<ChargingSiteFSEGrid {...mockProps} />, { wrapper })

    const rowButton = screen.getByText('Row Click')
    fireEvent.click(rowButton)

    expect(mockNavigate).toHaveBeenCalledWith(
      '/compliance-reporting/fse/456/edit',
      {
        state: { 
          returnTo: mockPathname,
          chargingSiteId: '123'
        }
      }
    )
  })

  it('renders New FSE button for BCeID users', () => {
    render(<ChargingSiteFSEGrid {...mockProps} />, { wrapper })

    const newFSEButton = screen.getByText('chargingSite:buttons.newFSE')
    expect(newFSEButton).toBeInTheDocument()
  })
})
