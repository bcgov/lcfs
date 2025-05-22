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

vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
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
    data: { report: { version: 1 }, chain: [] }
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
      fuelSupplies: [{ fuelSupplyId: 24 }, { fuelSupplyId: 25 }]
    },
    isLoading: false,
    error: null
  })
}))

vi.mock('@/hooks/useFinalSupplyEquipment', () => ({
  useGetFinalSupplyEquipments: () => ({
    data: {
      finalSupplyEquipments: [
        { finalSupplyEquipmentId: 24 },
        { finalSupplyEquipmentId: 25 }
      ]
    },
    isLoading: false,
    error: null
  })
}))
vi.mock('@/hooks/useAllocationAgreement', () => ({
  useGetAllAllocationAgreements: () => ({
    data: { allocationAgreements: [] },
    isLoading: false,
    error: null
  })
}))
vi.mock('@/hooks/useNotionalTransfer', () => ({
  useGetAllNotionalTransfers: () => ({
    data: { notionalTransfers: [] },
    isLoading: false,
    error: null
  })
}))
vi.mock('@/hooks/useOtherUses', () => ({
  useGetAllOtherUses: () => ({
    data: { otherUses: [] },
    isLoading: false,
    error: null
  })
}))
vi.mock('@/hooks/useFuelExport', () => ({
  useGetFuelExports: () => ({
    data: { fuelExports: [] },
    isLoading: false,
    error: null
  })
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
      // Now expect all visible activity panels to be expanded (three panels for supplemental)
      expect(screen.getAllByTestId(/panel\d+-summary/)).toHaveLength(3)
    })
  })

  it('hides empty accordions for supplemental reports', () => {
    // Default mock has version=1 (supplemental) and empty data for some sections
    render(
      <ReportDetails currentStatus="Submitted" userRoles={['Supplier']} />,
      {
        wrapper
      }
    )

    // Sections with data or supporting docs should be visible
    expect(screen.getByText(/report:reportDetails/))
      .toBeInTheDocument()
      .toBeInTheDocument()
    expect(screen.getByText('report:supportingDocs')).toBeInTheDocument()
    expect(
      screen.getByText('report:activityLists.supplyOfFuel')
    ).toBeInTheDocument()
    expect(
      screen.getByText('finalSupplyEquipment:fseTitle')
    ).toBeInTheDocument()

    // Empty sections should not be rendered
    expect(
      screen.queryByText('report:activityLists.allocationAgreements')
    ).toBeNull()
    expect(
      screen.queryByText('report:activityLists.notionalTransfers')
    ).toBeNull()
    expect(screen.queryByText('otherUses:summaryTitle')).toBeNull()
    expect(screen.queryByText('fuelExport:fuelExportTitle')).toBeNull()
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

  it('conditionally shows changelog toggles based on role and status', () => {
    vi.mock('@/hooks/useCurrentUser', () => ({
      useCurrentUser: () => ({
        data: { organization: { organizationId: '1' }, isGovernmentUser: true },
        hasRoles: (role) => role === 'Government'
      })
    }))

    vi.mock('@/hooks/useComplianceReports', () => ({
      useGetComplianceReport: () => ({
        data: {
          report: { complianceReportId: 2, version: 1 },
          chain: [
            { complianceReportId: 1, version: 0 },
            { complianceReportId: 2, version: 1 }
          ]
        }
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
              complianceReportId: 1,
              version: 0,
              fuelSupplyId: 24
            },
            {
              complianceReportId: 2,
              version: 0,
              fuelSupplyId: 25
            }
          ]
        },
        isLoading: false,
        error: null
      })
    }))

    render(
      <ReportDetails currentStatus="Submitted" userRoles={['Government']} />,
      { wrapper }
    )

    expect(screen.getAllByText('Change log off').length).toBeGreaterThan(0) // Changelog links visible
  })
})
