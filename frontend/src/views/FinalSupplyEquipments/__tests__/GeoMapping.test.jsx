import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import GeoMapping from '../GeoMapping'
import { wrapper } from '@/tests/utils/wrapper'
import * as utils from '../components/utils'

// Mock heavy dependencies
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => (
    <div data-test="map-container">{children}</div>
  )
}))

vi.mock('../components/MapComponents', () => ({
  BaseMap: () => <div data-test="base-map" />,
  MapBoundsHandler: () => <div data-test="bounds-handler" />,
  MapLegend: () => <div data-test="map-legend" />,
  MapMarkers: () => <div data-test="map-markers" />
}))

vi.mock('../components/StatusComponent', () => ({
  GeofencingStatus: ({ status }) => (
    <div data-test="geofencing-status">{status}</div>
  ),
  OverlapSummary: () => <div data-test="overlap-summary" />,
  LoadingState: () => <div data-test="loading-state" />,
  ErrorState: ({ resetGeofencing }) => (
    <div data-test="error-state">
      <button onClick={resetGeofencing}>Reset</button>
    </div>
  ),
  NoDataState: ({ resetGeofencing }) => (
    <div data-test="no-data-state">
      <button onClick={resetGeofencing}>Reset</button>
    </div>
  )
}))

vi.mock('../components/TableComponent', () => ({
  ExcelStyledTable: () => <div data-test="excel-table" />
}))

// Utility functions mock
vi.mock('../components/utils', () => ({
  fixLeafletIcons: vi.fn(),
  transformApiData: vi.fn((data) => data?.finalSupplyEquipments || []),
  groupLocationsByCoordinates: vi.fn((data) => ({ '0,0': data })),
  findOverlappingPeriods: vi.fn(() => [])
}))

// Mock the location service
let mockLocationService = {
  batchProcessGeofencing: vi.fn(() => Promise.resolve({}))
}

vi.mock('@/services/locationService', () => ({
  useLocationService: () => mockLocationService
}))

// Mock data
const mockSupplyEquipmentData = {
  finalSupplyEquipments: [
    {
      id: 1,
      finalSupplyEquipmentId: 1,
      uniqueId: 'u1',
      lat: 50.1234,
      lng: -120.5678,
      name: 'Station 1',
      serialNbr: 'SN001'
    },
    {
      id: 2,
      finalSupplyEquipmentId: 2,
      uniqueId: 'u2',
      lat: 51.2345,
      lng: -121.6789,
      name: 'Station 2',
      serialNbr: 'SN002'
    }
  ]
}

const mockTransformedData = [
  {
    id: 1,
    finalSupplyEquipmentId: 1,
    uniqueId: 'u1',
    lat: 50.1234,
    lng: -120.5678,
    name: 'Station 1',
    serialNbr: 'SN001'
  },
  {
    id: 2,
    finalSupplyEquipmentId: 2,
    uniqueId: 'u2',
    lat: 51.2345,
    lng: -121.6789,
    name: 'Station 2',
    serialNbr: 'SN002'
  }
]

describe('GeoMapping', () => {
  const mockTransformApiData = vi.mocked(utils.transformApiData)
  const mockGroupLocationsByCoordinates = vi.mocked(
    utils.groupLocationsByCoordinates
  )
  const mockFindOverlappingPeriods = vi.mocked(utils.findOverlappingPeriods)

  beforeEach(() => {
    vi.clearAllMocks()
    mockTransformApiData.mockImplementation(
      (data) => data?.finalSupplyEquipments || []
    )
    mockGroupLocationsByCoordinates.mockImplementation((data) => ({
      '0,0': data
    }))
    mockFindOverlappingPeriods.mockImplementation(() => [])
    mockLocationService.batchProcessGeofencing = vi.fn(() =>
      Promise.resolve({})
    )
  })

  it('shows no data state when data is null', () => {
    render(<GeoMapping complianceReportId="123" data={null} />, { wrapper })
    expect(screen.getByTestId('no-data-state')).toBeInTheDocument()
  })

  it('shows no data state when finalSupplyEquipments is empty', () => {
    render(
      <GeoMapping
        complianceReportId="123"
        data={{ finalSupplyEquipments: [] }}
      />,
      { wrapper }
    )
    expect(screen.getByTestId('error-state')).toBeInTheDocument()
  })

  it('renders the map when data is available', async () => {
    render(
      <GeoMapping complianceReportId="123" data={mockSupplyEquipmentData} />,
      { wrapper }
    )

    expect(screen.getByTestId('map-container')).toBeInTheDocument()
    expect(screen.getByTestId('base-map')).toBeInTheDocument()
    expect(screen.getByTestId('geofencing-status')).toBeInTheDocument()
  })

  it('processes API data when data loads', async () => {
    mockTransformApiData.mockReturnValue(mockTransformedData)
    mockGroupLocationsByCoordinates.mockReturnValue({
      '50.1234,-120.5678': [mockTransformedData[0]],
      '51.2345,-121.6789': [mockTransformedData[1]]
    })

    render(
      <GeoMapping complianceReportId="123" data={mockSupplyEquipmentData} />,
      { wrapper }
    )

    await waitFor(() => {
      expect(mockTransformApiData).toHaveBeenCalledWith(mockSupplyEquipmentData)
    })
    expect(mockGroupLocationsByCoordinates).toHaveBeenCalledWith(
      mockTransformedData
    )
  })

  it('handles empty transformed data by setting error state', async () => {
    mockTransformApiData.mockReturnValue([])

    render(
      <GeoMapping complianceReportId="123" data={mockSupplyEquipmentData} />,
      { wrapper }
    )

    await waitFor(() => {
      expect(mockTransformApiData).toHaveBeenCalled()
      expect(screen.getByTestId('error-state')).toBeInTheDocument()
    })
  })

  it('triggers geofencing when locations are loaded', async () => {
    mockTransformApiData.mockReturnValue(mockTransformedData)
    mockGroupLocationsByCoordinates.mockReturnValue({
      '50.1234,-120.5678': [mockTransformedData[0]]
    })
    mockLocationService.batchProcessGeofencing.mockResolvedValue({ 1: true })

    render(
      <GeoMapping complianceReportId="123" data={mockSupplyEquipmentData} />,
      { wrapper }
    )

    await waitFor(() => {
      expect(mockLocationService.batchProcessGeofencing).toHaveBeenCalled()
    })
  })

  it('handles geofencing errors', async () => {
    mockTransformApiData.mockReturnValue(mockTransformedData)
    mockGroupLocationsByCoordinates.mockReturnValue({
      '50.1234,-120.5678': [mockTransformedData[0]]
    })
    mockLocationService.batchProcessGeofencing.mockRejectedValue(
      new Error('Geofencing failed')
    )

    render(
      <GeoMapping complianceReportId="123" data={mockSupplyEquipmentData} />,
      { wrapper }
    )

    await waitFor(() => {
      expect(mockLocationService.batchProcessGeofencing).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByTestId('geofencing-status').textContent).toBe('error')
    })
  })

  it('calculates overlaps when geofencing is completed', async () => {
    mockTransformApiData.mockReturnValue(mockTransformedData)
    mockGroupLocationsByCoordinates.mockReturnValue({
      '50.1234,-120.5678': [mockTransformedData[0]]
    })
    mockLocationService.batchProcessGeofencing.mockResolvedValue({ 1: true })
    mockFindOverlappingPeriods.mockReturnValue(['overlap1'])

    render(
      <GeoMapping complianceReportId="123" data={mockSupplyEquipmentData} />,
      { wrapper }
    )

    await waitFor(() => {
      expect(mockLocationService.batchProcessGeofencing).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(mockFindOverlappingPeriods).toHaveBeenCalled()
    })
  })

  it('resets geofencing when reset button is clicked', async () => {
    mockTransformApiData.mockReturnValue(mockTransformedData)
    mockLocationService.batchProcessGeofencing.mockResolvedValue({ 1: true })

    render(
      <GeoMapping complianceReportId="123" data={mockSupplyEquipmentData} />,
      { wrapper }
    )

    await waitFor(() => {
      expect(mockLocationService.batchProcessGeofencing).toHaveBeenCalledTimes(
        1
      )
    })

    const resetButton = screen.getByRole('button', {
      name: /reset geofencing/i
    })
    fireEvent.click(resetButton)

    await waitFor(() => {
      expect(mockLocationService.batchProcessGeofencing).toHaveBeenCalledTimes(
        2
      )
    })
  })

  it('renders all map components', async () => {
    mockTransformApiData.mockReturnValue(mockTransformedData)
    mockGroupLocationsByCoordinates.mockReturnValue({
      '50.1234,-120.5678': [mockTransformedData[0]]
    })

    render(
      <GeoMapping complianceReportId="123" data={mockSupplyEquipmentData} />,
      { wrapper }
    )

    expect(screen.getByTestId('map-container')).toBeInTheDocument()
    expect(screen.getByTestId('base-map')).toBeInTheDocument()
    expect(screen.getByTestId('bounds-handler')).toBeInTheDocument()
    expect(screen.getByTestId('map-legend')).toBeInTheDocument()
    expect(screen.getByTestId('map-markers')).toBeInTheDocument()
  })

  it('processes geofencing results correctly for grouped locations', async () => {
    const groupedData = {
      '50.1234,-120.5678': [mockTransformedData[0], mockTransformedData[1]]
    }

    mockTransformApiData.mockReturnValue(mockTransformedData)
    mockGroupLocationsByCoordinates.mockReturnValue(groupedData)
    mockLocationService.batchProcessGeofencing.mockResolvedValue({ 1: true })

    render(
      <GeoMapping complianceReportId="123" data={mockSupplyEquipmentData} />,
      { wrapper }
    )

    await waitFor(() => {
      expect(mockLocationService.batchProcessGeofencing).toHaveBeenCalled()
    })

    // Verify that geofencing was called with unique locations
    const callArgs = mockLocationService.batchProcessGeofencing.mock.calls[0][0]
    expect(callArgs).toHaveLength(1) // Only one unique location from the group
  })

  it('handles BC and non-BC locations in overlap statistics', async () => {
    mockTransformApiData.mockReturnValue(mockTransformedData)
    mockGroupLocationsByCoordinates.mockReturnValue({
      '50.1234,-120.5678': [mockTransformedData[0]]
    })
    mockLocationService.batchProcessGeofencing.mockResolvedValue({
      1: true, // In BC
      2: false // Outside BC
    })
    mockFindOverlappingPeriods.mockReturnValue(['overlap1'])

    render(
      <GeoMapping complianceReportId="123" data={mockSupplyEquipmentData} />,
      { wrapper }
    )

    await waitFor(() => {
      expect(mockLocationService.batchProcessGeofencing).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(mockFindOverlappingPeriods).toHaveBeenCalled()
    })
  })
})
