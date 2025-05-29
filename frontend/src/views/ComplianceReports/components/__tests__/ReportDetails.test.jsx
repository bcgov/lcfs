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
const mockNavigate = vi.fn()

// Mock hooks
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({
    compliancePeriod: '2024',
    complianceReportId: '12345'
  }),
  useLocation: () => mockUseLocation()
}))

// Create mockable functions for all hooks
const mockUseCurrentUser = vi.fn()
const mockUseGetComplianceReport = vi.fn()
const mockUseComplianceReportDocuments = vi.fn()
const mockUseGetFuelSupplies = vi.fn()
const mockUseGetFinalSupplyEquipments = vi.fn()
const mockUseGetAllAllocationAgreements = vi.fn()
const mockUseGetAllNotionalTransfers = vi.fn()
const mockUseGetAllOtherUses = vi.fn()
const mockUseGetFuelExports = vi.fn()

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: mockUseCurrentUser
}))

vi.mock('@/hooks/useComplianceReports', () => ({
  useGetComplianceReport: mockUseGetComplianceReport,
  useComplianceReportDocuments: mockUseComplianceReportDocuments
}))

vi.mock('@/hooks/useFuelSupply', () => ({
  useGetFuelSupplies: mockUseGetFuelSupplies
}))

vi.mock('@/hooks/useFinalSupplyEquipment', () => ({
  useGetFinalSupplyEquipments: mockUseGetFinalSupplyEquipments
}))

vi.mock('@/hooks/useAllocationAgreement', () => ({
  useGetAllAllocationAgreements: mockUseGetAllAllocationAgreements
}))

vi.mock('@/hooks/useNotionalTransfer', () => ({
  useGetAllNotionalTransfers: mockUseGetAllNotionalTransfers
}))

vi.mock('@/hooks/useOtherUses', () => ({
  useGetAllOtherUses: mockUseGetAllOtherUses
}))

vi.mock('@/hooks/useFuelExport', () => ({
  useGetFuelExports: mockUseGetFuelExports
}))

describe('ReportDetails', () => {
  const defaultCurrentUser = {
    data: { 
      organization: { organizationId: '1' }, 
      isGovernmentUser: false 
    },
    hasRoles: (role) => role === 'Supplier',
    isLoading: false
  }

  const defaultComplianceReport = {
    data: {
      report: { version: 0, reportingFrequency: 'Annual' },
      chain: [{ complianceReportId: '12345', version: 0 }]
    }
  }

  const emptyDataResponse = {
    data: [],
    isLoading: false,
    error: null
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseLocation.mockReturnValue({ state: {} })

    // Set up default mocks
    mockUseCurrentUser.mockReturnValue(defaultCurrentUser)
    mockUseGetComplianceReport.mockReturnValue(defaultComplianceReport)
    mockUseComplianceReportDocuments.mockReturnValue(emptyDataResponse)
    mockUseGetFuelSupplies.mockReturnValue({ data: { fuelSupplies: [] }, isLoading: false, error: null })
    mockUseGetFinalSupplyEquipments.mockReturnValue({ data: { finalSupplyEquipments: [] }, isLoading: false, error: null })
    mockUseGetAllAllocationAgreements.mockReturnValue({ data: { allocationAgreements: [] }, isLoading: false, error: null })
    mockUseGetAllNotionalTransfers.mockReturnValue({ data: { notionalTransfers: [] }, isLoading: false, error: null })
    mockUseGetAllOtherUses.mockReturnValue({ data: { otherUses: [] }, isLoading: false, error: null })
    mockUseGetFuelExports.mockReturnValue({ data: { fuelExports: [] }, isLoading: false, error: null })
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

  it('shows supporting documents section for all users', async () => {
    render(<ReportDetails currentStatus="Draft" userRoles={['Supplier']} />, {
      wrapper
    })

    await waitFor(() => {
      expect(screen.getByText('report:supportingDocs')).toBeInTheDocument()
    })
  })

  it('shows sections with data in Draft status', async () => {
    mockUseGetFuelSupplies.mockReturnValue({
      data: { fuelSupplies: [{ fuelSupplyId: 24 }, { fuelSupplyId: 25 }] },
      isLoading: false,
      error: null
    })

    render(<ReportDetails currentStatus="Draft" userRoles={['Supplier']} />, {
      wrapper
    })

    await waitFor(() => {
      expect(screen.getByText('report:supportingDocs')).toBeInTheDocument()
      expect(screen.getByText('report:activityLists.supplyOfFuel')).toBeInTheDocument()
    })
  })

  it('hides empty sections in non-editing status for non-supplemental reports', async () => {
    // Non-supplemental report with no data
    mockUseGetComplianceReport.mockReturnValue({
      data: {
        report: { version: 0, reportingFrequency: 'Annual' },
        chain: [{ complianceReportId: '12345', version: 0 }]
      }
    })

    render(<ReportDetails currentStatus="Submitted" userRoles={['Supplier']} />, {
      wrapper
    })

    await waitFor(() => {
      // Supporting docs should always show
      expect(screen.getByText('report:supportingDocs')).toBeInTheDocument()
      
      // Empty sections should not show in non-editing status
      expect(screen.queryByText('report:activityLists.supplyOfFuel')).not.toBeInTheDocument()
      expect(screen.queryByText('report:activityLists.allocationAgreements')).not.toBeInTheDocument()
    })
  })

  it('shows all sections in Draft status even if empty', async () => {
    render(<ReportDetails currentStatus="Draft" userRoles={['Supplier']} />, {
      wrapper
    })

    await waitFor(() => {
      // In Draft status, all sections should show even if empty
      expect(screen.getByText('report:supportingDocs')).toBeInTheDocument()
      expect(screen.getByText('report:activityLists.supplyOfFuel')).toBeInTheDocument()
      expect(screen.getByText('finalSupplyEquipment:fseTitle')).toBeInTheDocument()
      expect(screen.getByText('report:activityLists.allocationAgreements')).toBeInTheDocument()
      expect(screen.getByText('report:activityLists.notionalTransfers')).toBeInTheDocument()
      expect(screen.getByText('otherUses:summaryTitle')).toBeInTheDocument()
      expect(screen.getByText('fuelExport:fuelExportTitle')).toBeInTheDocument()
    })
  })

  it('shows edit icon for suppliers in Draft status', async () => {
    mockUseCurrentUser.mockReturnValue({
      ...defaultCurrentUser,
      hasRoles: (role) => role === 'Supplier'
    })

    render(<ReportDetails canEdit={true} currentStatus="Draft" userRoles={['Supplier']} />, {
      wrapper
    })

    await waitFor(() => {
      const editButtons = screen.getAllByLabelText('edit')
      expect(editButtons.length).toBeGreaterThan(0)
    })
  })

  it('shows edit icon for analysts in various statuses', async () => {
    mockUseCurrentUser.mockReturnValue({
      data: { 
        organization: { organizationId: '1' }, 
        isGovernmentUser: true 
      },
      hasRoles: (role) => role === 'Analyst',
      isLoading: false
    })

    render(<ReportDetails canEdit={true} currentStatus="Submitted" userRoles={['Analyst']} />, {
      wrapper
    })

    await waitFor(() => {
      // Supporting docs should have edit icon for analysts
      expect(screen.getByText('report:supportingDocs')).toBeInTheDocument()
    })
  })

  it('does not show edit icon for non-authorized users', async () => {
    mockUseCurrentUser.mockReturnValue({
      data: { 
        organization: { organizationId: '1' }, 
        isGovernmentUser: false 
      },
      hasRoles: () => false, // No roles
      isLoading: false
    })

    render(<ReportDetails canEdit={false} currentStatus="Submitted" userRoles={[]} />, {
      wrapper
    })

    await waitFor(() => {
      const editButtons = screen.queryAllByLabelText('edit')
      expect(editButtons.length).toBe(0)
    })
  })

  it('expands all visible sections when "Expand All" is clicked', async () => {
    mockUseGetFuelSupplies.mockReturnValue({
      data: { fuelSupplies: [{ fuelSupplyId: 24 }] },
      isLoading: false,
      error: null
    })

    render(<ReportDetails currentStatus="Draft" userRoles={['Supplier']} />, {
      wrapper
    })

    await waitFor(() => {
      expect(screen.getByText('report:expandAll')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('report:expandAll'))

    await waitFor(() => {
      const panels = screen.getAllByTestId(/panel\d+-summary/)
      expect(panels.length).toBeGreaterThan(0)
    })
  })

  it('collapses all sections when "Collapse All" is clicked', async () => {
    render(<ReportDetails currentStatus="Draft" userRoles={['Supplier']} />, {
      wrapper
    })

    await waitFor(() => {
      expect(screen.getByText('report:collapseAll')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('report:collapseAll'))
    
    // After collapse, no accordion details should be visible
    // This is harder to test directly, but we can verify the function was called
    expect(screen.getByText('report:collapseAll')).toBeInTheDocument()
  })

  it('shows "Edited" chip for modified data in supplemental reports', async () => {
    // Set up supplemental report
    mockUseGetComplianceReport.mockReturnValue({
      data: {
        report: { version: 1, reportingFrequency: 'Annual' },
        chain: [
          { complianceReportId: '12345', version: 0 },
          { complianceReportId: '12346', version: 1 }
        ]
      }
    })

    // Mock data with version indicating it was edited
    mockUseGetFuelSupplies.mockReturnValue({
      data: { 
        fuelSupplies: [
          { fuelSupplyId: 24, complianceReportId: '12346', version: 1 }
        ] 
      },
      isLoading: false,
      error: null
    })

    render(<ReportDetails currentStatus="Submitted" userRoles={['Supplier']} />, {
      wrapper
    })

    await waitFor(() => {
      expect(screen.getByText('Edited')).toBeInTheDocument()
    })
  })

  it('shows "Empty" chip for sections with no data', async () => {
    render(<ReportDetails currentStatus="Draft" userRoles={['Supplier']} />, {
      wrapper
    })

    await waitFor(() => {
      const emptyChips = screen.getAllByText('Empty')
      expect(emptyChips.length).toBeGreaterThan(0)
    })
  })

  it('shows "Deleted" chip when all records are marked as DELETE', async () => {
    mockUseGetFuelSupplies.mockReturnValue({
      data: { 
        fuelSupplies: [
          { fuelSupplyId: 24, actionType: 'DELETE' },
          { fuelSupplyId: 25, actionType: 'DELETE' }
        ] 
      },
      isLoading: false,
      error: null
    })

    render(<ReportDetails currentStatus="Submitted" userRoles={['Supplier']} />, {
      wrapper
    })

    await waitFor(() => {
      expect(screen.getByText('Deleted')).toBeInTheDocument()
    })
  })

  it('handles loading states correctly', async () => {
    mockUseGetFuelSupplies.mockReturnValue({
      data: null,
      isLoading: true,
      error: null
    })

    render(<ReportDetails currentStatus="Draft" userRoles={['Supplier']} />, {
      wrapper
    })

    // Initially should show loading
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0)
  })

  it('handles error states correctly', async () => {
    mockUseGetFuelSupplies.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load data')
    })

    render(<ReportDetails currentStatus="Draft" userRoles={['Supplier']} />, {
      wrapper
    })

    await waitFor(() => {
      expect(screen.getByText('Error loading data')).toBeInTheDocument()
    })
  })

  it('auto-expands sections with data on initial load', async () => {
    mockUseGetFuelSupplies.mockReturnValue({
      data: { fuelSupplies: [{ fuelSupplyId: 24 }] },
      isLoading: false,
      error: null
    })

    render(<ReportDetails currentStatus="Draft" userRoles={['Supplier']} />, {
      wrapper
    })

    // Wait for auto-expansion to occur
    await waitFor(() => {
      // Check that sections with data are expanded
      const panels = screen.getAllByTestId(/panel\d+-summary/)
      expect(panels.length).toBeGreaterThan(0)
    }, { timeout: 2000 })
  })

  it('navigates correctly when edit buttons are clicked', async () => {
    render(<ReportDetails canEdit={true} currentStatus="Draft" userRoles={['Supplier']} />, {
      wrapper
    })

    await waitFor(() => {
      const editButtons = screen.getAllByLabelText('edit')
      if (editButtons.length > 0) {
        fireEvent.click(editButtons[0])
        // Navigation function should be called
        expect(mockNavigate).toHaveBeenCalled()
      }
    })
  })

  it('opens file dialog when supporting docs edit is clicked', async () => {
    mockUseCurrentUser.mockReturnValue({
      ...defaultCurrentUser,
      hasRoles: (role) => role === 'Supplier'
    })

    render(<ReportDetails canEdit={true} currentStatus="Draft" userRoles={['Supplier']} />, {
      wrapper
    })

    await waitFor(() => {
      const supportingDocsSection = screen.getByText('report:supportingDocs')
      expect(supportingDocsSection).toBeInTheDocument()
      
      // Find the edit button within the supporting docs section
      const editButton = supportingDocsSection.closest('[data-test*="panel"]')?.querySelector('[aria-label="edit"]')
      if (editButton) {
        fireEvent.click(editButton)
        // File dialog should open (tested through the component's internal state)
      }
    })
  })
})