import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FuelCodeDetail } from '../FuelCodeDetail'
import { wrapper } from '@/tests/utils/wrapper'

const mockGridViewer = vi.fn(() => <div data-test="iterations-grid">Grid</div>)

vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: (props) => mockGridViewer(props)
}))

vi.mock('echarts-for-react', () => ({
  default: ({ option }) => (
    <div data-test="volume-chart">{option?.series?.[0]?.data?.join(',')}</div>
  )
}))

vi.mock('@/utils/withRole', () => ({
  default: (Component) => Component
}))

vi.mock('@/views/CarbonIntensity/components/FuelCodesTabs', () => ({
  FuelCodesTabs: () => <div data-test="fuel-code-tabs" />
}))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: () => ({ fuelCodeID: '100' })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'fuelCode:detail.iteration': 'Iteration',
        'fuelCode:detail.iterationsSuffix': 'Iterations',
        'fuelCode:detail.allIterationsTitle': 'All iterations',
        'fuelCode:detail.latestIterationTitle': 'Latest iteration',
        'fuelCode:detail.defaultNotes': 'No notes provided',
        'fuelCode:detail.noVolumeData': 'No volume data',
        'fuelCode:detail.chartAriaDescription': 'Volume over time',
        'fuelCode:detail.totalVolume': 'Total Volume',
        'fuelCode:detail.year': 'Year',
        'fuelCode:detail.volumeOverTimeTitle': 'Volume over time',
        'fuelCode:fuelCodeColLabels.status': 'Status',
        'fuelCode:fuelCodeColLabels.prefix': 'Prefix',
        'fuelCode:fuelCodeColLabels.applicationDate': 'Application date',
        'fuelCode:fuelCodeColLabels.approvalDate': 'Approval date',
        'fuelCode:fuelCodeColLabels.effectiveDate': 'Effective date',
        'fuelCode:fuelCodeColLabels.expirationDate': 'Expiry date',
        'fuelCode:noFuelCodesFound': 'No fuel codes found'
      }
      return translations[key] || key
    }
  })
}))

const mockUseGetFuelCodeGroup = vi.fn()

vi.mock('@/hooks/useFuelCode', () => ({
  useGetFuelCodeGroup: (...args) => mockUseGetFuelCodeGroup(...args),
  useFuelCodeStatuses: vi.fn(() => ({
    data: [{ status: 'Approved' }, { status: 'Draft' }]
  }))
}))

vi.mock('@/stores/useFuelCodePageStore', () => ({
  useFuelCodePageStore: (selector) =>
    selector({
      setFuelCodeTitle: vi.fn()
    })
}))

const latestIteration = {
  fuelCodeId: 100,
  fuelCodePrefix: { prefix: 'C-BCLCF-' },
  prefix: 'C-BCLCF-',
  fuelSuffix: '100.2',
  fuelCodeStatus: { status: 'Approved' },
  fuelType: { fuelType: 'Diesel' },
  carbonIntensity: 47.12,
  company: 'Fuel Producer Ltd.',
  applicationDate: '2026-01-10',
  approvalDate: '2026-02-10',
  effectiveDate: '2026-03-01',
  expirationDate: null,
  feedstock: 'Canola oil',
  feedstockLocation: 'Saskatchewan, Canada',
  feedstockFuelTransportModes: [],
  finishedFuelTransportModes: [],
  fuelProductionFacilityCity: 'Victoria',
  fuelProductionFacilityProvinceState: 'BC',
  fuelProductionFacilityCountry: 'Canada',
  facilityNameplateCapacity: 1000000,
  facilityNameplateCapacityUnit: 'Litres',
  coProcessed: 'No',
  notes: 'Approved pathway'
}

const groupData = {
  latestIteration,
  iterations: [
    {
      fuelCodeId: 100,
      prefix: 'C-BCLCF-',
      fuelSuffix: '100.2',
      status: 'Approved',
      carbonIntensity: 47.12,
      applicationDate: '2026-01-10',
      approvalDate: '2026-02-10',
      effectiveDate: '2026-03-01',
      expirationDate: null
    },
    {
      fuelCodeId: 99,
      prefix: 'C-BCLCF-',
      fuelSuffix: '100.1',
      status: 'Approved',
      carbonIntensity: 48.55,
      applicationDate: '2025-01-10',
      approvalDate: '2025-02-10',
      effectiveDate: '2025-03-01',
      expirationDate: null
    }
  ],
  volumeOverTime: [
    { year: '2025', totalVolume: 1234 },
    { year: '2026', totalVolume: 2345 }
  ]
}

describe('FuelCodeDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseGetFuelCodeGroup.mockReturnValue({
      data: groupData,
      isLoading: false,
      isError: false,
      error: null
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the detail title, iterations grid, and chart', () => {
    render(<FuelCodeDetail />, { wrapper })

    expect(screen.getByTestId('fuel-code-tabs')).toBeInTheDocument()
    expect(screen.getByTestId('iterations-grid')).toBeInTheDocument()
    expect(screen.getByText('C-BCLCF-100')).toBeInTheDocument()
    expect(screen.getByText('C-BCLCF-100 Iterations')).toBeInTheDocument()
    expect(screen.getByTestId('volume-chart')).toHaveTextContent('1234,2345')
  })

  it('passes pagination and stable filter props to the iterations grid', () => {
    render(<FuelCodeDetail />, { wrapper })

    const gridProps = mockGridViewer.mock.calls[0][0]

    expect(gridProps.enablePageCaching).toBe(false)
    expect(gridProps.suppressPagination).toBeUndefined()
    expect(gridProps.paginationOptions).toMatchObject({
      page: 1,
      size: 10,
      filters: []
    })
    expect(gridProps.gridOptions).toMatchObject({
      pagination: true,
      paginationPageSize: 10
    })
    expect(gridProps.queryData.data.pagination).toEqual({
      page: 1,
      size: 10,
      total: 2
    })
  })

  it('shows skeleton loading state instead of rendering the grid while loading', () => {
    mockUseGetFuelCodeGroup.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null
    })

    render(<FuelCodeDetail />, { wrapper })

    expect(screen.queryByTestId('iterations-grid')).not.toBeInTheDocument()
    expect(screen.getByText('All iterations')).toBeInTheDocument()
  })
})
