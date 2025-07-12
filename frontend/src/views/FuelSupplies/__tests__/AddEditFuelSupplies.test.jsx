import { useComplianceReportWithCache } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useFuelSupplyOptions,
  useGetFuelSuppliesList,
  useSaveFuelSupply
} from '@/hooks/useFuelSupply'
import { wrapper } from '@/tests/utils/wrapper'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AddEditFuelSupplies } from '../AddEditFuelSupplies'

// Mock react-router-dom hooks
const mockUseLocation = vi.fn()
const mockUseNavigate = vi.fn()
const mockUseParams = vi.fn()

vi.mock('@/hooks/useCurrentUser')

vi.mock('@/hooks/useComplianceReports')

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockUseNavigate(),
  useParams: () => mockUseParams()
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock all hooks related to fuel supply
vi.mock('@/hooks/useFuelSupply')

// Mock BCGridEditor to verify props without rendering the full grid
vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
  BCGridEditor: ({
    gridRef,
    alertRef,
    onGridReady,
    rowData,
    onCellValueChanged,
    onCellEditingStopped
  }) => (
    <div data-test="bc-grid-editor">
      <div data-test="row-data">
        {rowData.map((row, index) => (
          <div key={index} data-test="grid-row">
            {row.id}
          </div>
        ))}
      </div>
    </div>
  )
}))

describe('AddEditFuelSupplies', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    // Mock location, navigate, and params
    mockUseLocation.mockReturnValue({
      pathname: '/test-path',
      state: {}
    })
    mockUseNavigate.mockReturnValue(vi.fn())
    mockUseParams.mockReturnValue({
      complianceReportId: 'testReportId',
      compliancePeriod: '2024-Q1'
    })

    // Mock useFuelSupplyOptions to return no fuel types initially
    vi.mocked(useFuelSupplyOptions).mockReturnValue({
      data: { fuelTypes: [] },
      isLoading: false,
      isFetched: true
    })

    // Mock useGetFuelSuppliesList to return empty data initially
    vi.mocked(useGetFuelSuppliesList).mockReturnValue({
      data: { fuelSupplies: [] },
      isLoading: false
    })

    // Mock useSaveFuelSupply hook
    vi.mocked(useSaveFuelSupply).mockReturnValue({
      mutateAsync: vi.fn()
    })

    // Mock useCurrentUser (though not used in component)
    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        organization: { organizationId: 1 }
      }
    })

    // Mock useComplianceReportWithCache (this is the correct hook used in the component)
    vi.mocked(useComplianceReportWithCache).mockReturnValue({
      data: {
        report: {
          version: 0,
          reportingFrequency: 'ANNUAL'
        }
      },
      isLoading: false
    })
  })

  it('renders the component', () => {
    render(<AddEditFuelSupplies />, { wrapper })
    // Check for a title or any text that indicates successful rendering
    expect(screen.getByText('fuelSupply:fuelSupplyTitle')).toBeInTheDocument()
  })

  it('initializes with at least one row when there are no existing fuel supplies', () => {
    render(<AddEditFuelSupplies />, { wrapper })
    const rows = screen.getAllByTestId('grid-row')
    // Should contain exactly one blank row if data is empty
    expect(rows.length).toBe(1)
  })

  it('loads existing fuel supplies when available', async () => {
    // Update mock to provide some existing fuel supplies
    vi.mocked(useGetFuelSuppliesList).mockReturnValue({
      data: {
        fuelSupplies: [
          { fuelSupplyId: 'abc', fuelType: 'Diesel' },
          { fuelSupplyId: 'xyz', fuelType: 'Gasoline' }
        ]
      },
      isLoading: false
    })

    render(<AddEditFuelSupplies />, { wrapper })
    const rows = await screen.findAllByTestId('grid-row')
    // Should contain 2 existing fuel supplies + 1 empty row at the end
    expect(rows.length).toBe(3)
  })

  it('handles supplemental report correctly', () => {
    // Mock for supplemental report (version > 0)
    vi.mocked(useComplianceReportWithCache).mockReturnValue({
      data: {
        report: {
          version: 1,
          reportingFrequency: 'ANNUAL'
        }
      },
      isLoading: false
    })

    render(<AddEditFuelSupplies />, { wrapper })
    expect(screen.getByText('fuelSupply:fuelSupplyTitle')).toBeInTheDocument()
  })

  it('handles early issuance report correctly', () => {
    // Mock for early issuance report (quarterly)
    vi.mocked(useComplianceReportWithCache).mockReturnValue({
      data: {
        report: {
          version: 0,
          reportingFrequency: 'QUARTERLY'
        }
      },
      isLoading: false
    })

    render(<AddEditFuelSupplies />, { wrapper })
    expect(screen.getByText('fuelSupply:fuelSupplyTitle')).toBeInTheDocument()
  })
})
