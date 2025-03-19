import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ReportDetails from '../ReportDetails'
import { wrapper } from '@/tests/utils/wrapper.jsx'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key // return keys directly
  })
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    setForbidden: vi.fn()
  })
}))

vi.mock('@react-keycloak/web', () => ({
  ReactKeycloakProvider: ({ children }) => children,
  useKeycloak: () => ({
    keycloak: {
      authenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn()
    },
    initialized: true
  })
}))

const mockUseLocation = vi.fn()

// Mock hooks
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({
    compliancePeriod: '2024',
    complianceReportId: '12345'
  }),
  useLocation: () => mockUseLocation()
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { organization: { organizationId: '1' }, isGovernmentUser: false },
    hasRoles: (role) => role === 'Supplier'
  })
}))

vi.mock('@/hooks/useComplianceReports', () => ({
  useGetComplianceReport: () => ({
    data: { report: { version: 1 } }
  }),
  useComplianceReportDocuments: () => ({
    data: [],
    isLoading: false,
    error: null
  })
}))

vi.mock('@/hooks/useFuelSupply', () => ({
  useGetFuelSupplies: () => ({
    data: {
      fuelSupplies: [
        {
          fuelSupplyId: 24
        },
        {
          fuelSupplyId: 25
        }
      ]
    },
    isLoading: false,
    error: null
  })
}))

vi.mock('@/hooks/useFinalSupplyEquipment', () => ({
  useGetFinalSupplyEquipments: () => ({
    data: {
      finalSupplyEquipments: [
        {
          finalSupplyEquipmentId: 24
        },
        {
          finalSupplyEquipmentId: 25
        }
      ]
    },
    isLoading: false,
    error: null
  })
}))
vi.mock('@/hooks/useAllocationAgreement', () => ({
  useGetAllocationAgreements: () => ({
    data: { allocationAgreements: [] },
    isLoading: false,
    error: null
  })
}))
vi.mock('@/hooks/useNotionalTransfer', () => ({
  useGetAllNotionalTransfers: () => ({
    data: [],
    isLoading: false,
    error: null
  })
}))
vi.mock('@/hooks/useOtherUses', () => ({
  useGetAllOtherUses: () => ({ data: [], isLoading: false, error: null })
}))
vi.mock('@/hooks/useFuelExport', () => ({
  useGetFuelExports: () => ({ data: [], isLoading: false, error: null })
}))

describe('ReportDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseLocation.mockReturnValue({ state: {} })
  })

  it('renders without crashing', () => {
    render(<ReportDetails currentStatus="Draft" userRoles={['Supplier']} />, {
      wrapper
    })
    expect(screen.getByText(/report:reportDetails/)).toBeInTheDocument()
  })

  it('shows "Expand All" and "Collapse All" buttons', () => {
    render(<ReportDetails currentStatus="Draft" userRoles={['Supplier']} />, {
      wrapper
    })

    expect(screen.getByText('report:expandAll')).toBeInTheDocument()
    expect(screen.getByText('report:collapseAll')).toBeInTheDocument()
  })

  it('expands all sections when "Expand All" is clicked', async () => {
    render(<ReportDetails currentStatus="Draft" userRoles={['Supplier']} />, {
      wrapper
    })

    fireEvent.click(screen.getByText('report:expandAll'))

    await waitFor(() => {
      expect(screen.getAllByTestId(/panel\d+-summary/)).toHaveLength(2)
    })
  })

  it('does NOT render edit icon if not allowed by role', () => {
    vi.mock('@/hooks/useCurrentUser', () => ({
      useCurrentUser: () => ({
        data: {
          organization: { organizationId: '1' },
          isGovernmentUser: false
        },
        hasRoles: () => false // No roles
      })
    }))

    render(<ReportDetails currentStatus="Draft" userRoles={['Supplier']} />, {
      wrapper
    })

    const editButtons = screen.queryAllByLabelText('edit')
    expect(editButtons.length).toBe(0) // No edit icons visible
  })

  it('conditionally shows changelog button based on role and status', () => {
    vi.mock('@/hooks/useCurrentUser', () => ({
      useCurrentUser: () => ({
        data: { organization: { organizationId: '1' }, isGovernmentUser: true },
        hasRoles: (role) => role === 'Government'
      })
    }))

    render(
      <ReportDetails currentStatus="Submitted" userRoles={['Government']} />,
      { wrapper }
    )

    expect(screen.getAllByText('report:changelog').length).toBeGreaterThan(0) // Changelog links visible
  })
})
