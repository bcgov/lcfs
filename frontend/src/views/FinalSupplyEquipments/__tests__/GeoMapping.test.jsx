import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import GeoMapping from '../GeoMapping'
import { wrapper } from '@/tests/utils/wrapper'

// ------ Shared mocks across tests ------ //
// These imports are extremely heavy (leaflet, map tiling, etc.) so we stub
// them once here to keep the tests lightweight.
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
  ErrorState: () => <div data-test="error-state" />,
  NoDataState: () => <div data-test="no-data-state" />
}))

vi.mock('../components/TableComponent', () => ({
  ExcelStyledTable: () => <div data-test="excel-table" />
}))

// Utility functions are computational but not UI – we mock them to trivial
// behaviour so we can focus on component state-flow rather than algorithmic
// correctness (those have their own unit tests elsewhere).
vi.mock('../components/utils', () => ({
  fixLeafletIcons: vi.fn(),
  transformApiData: (data) => data.finalSupplyEquipments, // return array
  groupLocationsByCoordinates: (data) => ({ '0,0': data }),
  findOverlappingPeriods: () => []
}))

vi.mock('@/services/locationService', () => ({
  useLocationService: () => ({
    batchProcessGeofencing: () => Promise.resolve({}),
    isLoading: false,
    error: null
  })
}))

// We will provide custom responses for the hook inside each test via a helper
let hookResponse
vi.mock('@/hooks/useFinalSupplyEquipment', () => ({
  useGetFinalSupplyEquipments: () => hookResponse
}))

// Helper to render with wrapper and customise hook output
const renderWithHook = (customResponse) => {
  hookResponse = customResponse
  return render(<GeoMapping complianceReportId="123" />, { wrapper })
}

// ------ Test suite ------ //

describe('GeoMapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state', () => {
    renderWithHook({ isLoading: true })
    expect(screen.getByTestId('loading-state')).toBeInTheDocument()
  })

  it('shows error state when hook reports error', () => {
    renderWithHook({ isLoading: false, isError: true, refetch: vi.fn() })
    expect(screen.getByTestId('error-state')).toBeInTheDocument()
  })

  it('shows no data state when hook returns no dataset', () => {
    renderWithHook({
      isLoading: false,
      isError: false,
      data: null,
      refetch: vi.fn()
    })
    expect(screen.getByTestId('no-data-state')).toBeInTheDocument()
  })

  it('renders the map when data is available', async () => {
    const mockData = {
      finalSupplyEquipments: [
        {
          id: 1,
          finalSupplyEquipmentId: 1,
          uniqueId: 'u1',
          lat: 50,
          lng: -120,
          name: 'Station 1'
        }
      ]
    }

    renderWithHook({
      isLoading: false,
      isError: false,
      data: mockData,
      refetch: vi.fn()
    })

    // Because utilities are mocked to finish instantly, we should land on the
    // completed map state.
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
    expect(screen.getByTestId('base-map')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('geofencing-status').textContent).not.toBe(
        'idle'
      )
    })
  })
})
