import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AddEditFuelSupplies } from '../AddEditFuelSupplies'
import { wrapper } from '@/tests/utils/wrapper'
import {
  useFuelSupplyOptions,
  useGetFuelSupplies,
  useSaveFuelSupply
} from '@/hooks/useFuelSupply'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

// Mock react-router-dom hooks
const mockUseLocation = vi.fn()
const mockUseNavigate = vi.fn()
const mockUseParams = vi.fn()

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

    // Mock useGetFuelSupplies to return empty data initially
    vi.mocked(useGetFuelSupplies).mockReturnValue({
      data: { fuelSupplies: [] },
      isLoading: false
    })

    // Mock useSaveFuelSupply hook
    vi.mocked(useSaveFuelSupply).mockReturnValue({
      mutateAsync: vi.fn()
    })
  })

  it('renders the component', () => {
    render(<AddEditFuelSupplies />, { wrapper })
    // Check for a title or any text that indicates successful rendering
    expect(
      screen.getByText('fuelSupply:fuelSupplyTitle')
    ).toBeInTheDocument()
  })

  it('initializes with at least one row when there are no existing fuel supplies', () => {
    render(<AddEditFuelSupplies />, { wrapper })
    const rows = screen.getAllByTestId('grid-row')
    // Should contain exactly one blank row if data is empty
    expect(rows.length).toBe(1)
  })

  it('loads existing fuel supplies when available', async () => {
    // Update mock to provide some existing fuel supplies
    vi.mocked(useGetFuelSupplies).mockReturnValue({
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
    expect(rows.length).toBe(2)
  })
})
