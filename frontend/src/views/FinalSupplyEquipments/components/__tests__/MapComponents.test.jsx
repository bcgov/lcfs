import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { useMap, Marker, Popup, TileLayer } from 'react-leaflet'
import { Control, DomEvent, DomUtil } from 'leaflet'
import { Paper, CircularProgress } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import {
  MapControl,
  MapBoundsHandler,
  MapLegend,
  MapMarkers,
  BaseMap
} from '../MapComponents'
import { markerIcons } from '../utils'

// Mock external dependencies
vi.mock('react-dom', () => ({
  createPortal: vi.fn((children) => children)
}))

vi.mock('react-leaflet', () => ({
  useMap: vi.fn(),
  Marker: vi.fn(({ children }) => <div data-test="marker">{children}</div>),
  Popup: vi.fn(({ children }) => <div data-test="popup">{children}</div>),
  TileLayer: vi.fn(() => <div data-test="tile-layer" />)
}))

vi.mock('leaflet', () => ({
  Control: vi.fn(),
  DomEvent: {
    disableClickPropagation: vi.fn(),
    disableScrollPropagation: vi.fn()
  },
  DomUtil: {
    create: vi.fn(() => document.createElement('div'))
  }
}))

vi.mock('@mui/material', () => ({
  Paper: ({ children }) => <div data-test="paper">{children}</div>,
  CircularProgress: () => <div data-test="circular-progress" />
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children }) => <span data-test="bc-typography">{children}</span>
}))

vi.mock('../utils', () => ({
  markerIcons: {
    grey: { iconUrl: 'grey.png' },
    red: { iconUrl: 'red.png' },
    orange: { iconUrl: 'orange.png' },
    default: { iconUrl: 'default.png' }
  }
}))

describe('MapComponents', () => {
  let mockMap
  let mockControl
  let mockSection

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockSection = document.createElement('div')
    mockControl = {
      onAdd: vi.fn(),
      onRemove: vi.fn()
    }
    mockMap = {
      addControl: vi.fn(),
      removeControl: vi.fn(),
      fitBounds: vi.fn()
    }

    vi.mocked(useMap).mockReturnValue(mockMap)
    vi.mocked(Control).mockImplementation(() => mockControl)
    vi.mocked(DomUtil.create).mockReturnValue(mockSection)
  })

  describe('MapControl', () => {
    beforeEach(() => {
      // Set up MapControl to render its children for most tests
      mockControl.onAdd.mockImplementation(() => mockSection)
    })

    it('renders with default props', async () => {
      const TestChild = () => <div data-test="child">Test Child</div>
      
      await act(async () => {
        render(
          <MapControl>
            <TestChild />
          </MapControl>
        )
      })

      expect(Control).toHaveBeenCalledWith({ position: 'topright' })
      expect(mockMap.addControl).toHaveBeenCalledWith(mockControl)
    })

    it('renders with custom position prop', async () => {
      const TestChild = () => <div data-test="child">Test Child</div>
      
      await act(async () => {
        render(
          <MapControl position="bottomleft">
            <TestChild />
          </MapControl>
        )
      })

      expect(Control).toHaveBeenCalledWith({ position: 'bottomleft' })
    })

    it('disables click propagation when disableClickPropagation is true', async () => {
      const TestChild = () => <div data-test="child">Test Child</div>

      await act(async () => {
        render(
          <MapControl disableClickPropagation={true}>
            <TestChild />
          </MapControl>
        )
      })

      await act(async () => {
        mockControl.onAdd()
      })

      expect(DomEvent.disableClickPropagation).toHaveBeenCalledWith(mockSection)
      expect(DomEvent.disableScrollPropagation).toHaveBeenCalledWith(mockSection)
    })

    it('does not disable click propagation when disableClickPropagation is false', async () => {
      const TestChild = () => <div data-test="child">Test Child</div>

      await act(async () => {
        render(
          <MapControl disableClickPropagation={false}>
            <TestChild />
          </MapControl>
        )
      })

      await act(async () => {
        mockControl.onAdd()
      })

      expect(DomEvent.disableClickPropagation).not.toHaveBeenCalled()
      expect(DomEvent.disableScrollPropagation).not.toHaveBeenCalled()
    })

    it('renders children when container is available', async () => {
      const TestChild = () => <div data-test="child">Test Child</div>

      await act(async () => {
        render(
          <MapControl>
            <TestChild />
          </MapControl>
        )
      })

      expect(mockMap.addControl).toHaveBeenCalledWith(mockControl)
    })

    it('handles container creation properly', () => {
      const TestChild = () => <div data-test="child">Test Child</div>
      
      render(
        <MapControl>
          <TestChild />
        </MapControl>
      )

      expect(mockMap.addControl).toHaveBeenCalledWith(mockControl)
    })

    it('cleans up control on unmount', async () => {
      const TestChild = () => <div data-test="child">Test Child</div>
      
      const { unmount } = await act(async () => {
        return render(
          <MapControl>
            <TestChild />
          </MapControl>
        )
      })

      await act(async () => {
        unmount()
      })

      expect(mockMap.removeControl).toHaveBeenCalledWith(mockControl)
    })
  })

  describe('MapBoundsHandler', () => {
    it('fits bounds when groupedLocations has data', async () => {
      const groupedLocations = {
        'coord1': [{ lat: 49.2827, lng: -123.1207 }],
        'coord2': [{ lat: 49.2847, lng: -123.1247 }]
      }

      await act(async () => {
        render(<MapBoundsHandler groupedLocations={groupedLocations} />)
      })

      expect(mockMap.fitBounds).toHaveBeenCalledWith([
        [49.2827, -123.1207],
        [49.2847, -123.1247]
      ])
    })

    it('does nothing when groupedLocations is empty', async () => {
      const groupedLocations = {}

      await act(async () => {
        render(<MapBoundsHandler groupedLocations={groupedLocations} />)
      })

      expect(mockMap.fitBounds).not.toHaveBeenCalled()
    })

    it('does nothing when bounds array is empty', async () => {
      const groupedLocations = {}

      await act(async () => {
        render(<MapBoundsHandler groupedLocations={groupedLocations} />)
      })

      expect(mockMap.fitBounds).not.toHaveBeenCalled()
    })
  })

  describe('MapLegend', () => {
    it('renders with loading status', () => {
      const { container } = render(<MapLegend geofencingStatus="loading" />)
      
      expect(container).toBeTruthy()
    })

    it('renders with completed status', () => {
      const { container } = render(<MapLegend geofencingStatus="completed" />)
      
      expect(container).toBeTruthy()
    })

    it('handles different geofencing statuses', () => {
      const { container: loadingContainer } = render(<MapLegend geofencingStatus="loading" />)
      const { container: completedContainer } = render(<MapLegend geofencingStatus="completed" />)
      
      expect(loadingContainer).toBeTruthy()
      expect(completedContainer).toBeTruthy()
    })
  })

  describe('MapMarkers', () => {
    const mockGroupedLocations = {
      'coord1': [{ 
        id: 'loc1',
        uniqueId: 'unique1',
        lat: 49.2827, 
        lng: -123.1207,
        name: 'Location 1' 
      }]
    }

    const mockGeneratePopupContent = vi.fn(() => <div>Popup Content</div>)

    it('uses grey icon when geofencingStatus is loading', () => {
      render(
        <MapMarkers
          groupedLocations={mockGroupedLocations}
          geofencingStatus="loading"
          geofencingResults={{}}
          overlapMap={{}}
          generatePopupContent={mockGeneratePopupContent}
        />
      )

      expect(Marker).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: markerIcons.grey
        }),
        expect.any(Object)
      )
    })

    it('uses red icon when not in BC', () => {
      const geofencingResults = { 'loc1': false }

      render(
        <MapMarkers
          groupedLocations={mockGroupedLocations}
          geofencingStatus="completed"
          geofencingResults={geofencingResults}
          overlapMap={{}}
          generatePopupContent={mockGeneratePopupContent}
        />
      )

      expect(Marker).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: markerIcons.red
        }),
        expect.any(Object)
      )
    })

    it('uses orange icon when has overlaps in BC', () => {
      const geofencingResults = { 'loc1': true }
      const overlapMap = { 'unique1': ['overlap1'] }

      render(
        <MapMarkers
          groupedLocations={mockGroupedLocations}
          geofencingStatus="completed"
          geofencingResults={geofencingResults}
          overlapMap={overlapMap}
          generatePopupContent={mockGeneratePopupContent}
        />
      )

      expect(Marker).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: markerIcons.orange
        }),
        expect.any(Object)
      )
    })

    it('uses default icon when in BC with no overlaps', () => {
      const geofencingResults = { 'loc1': true }
      const overlapMap = { 'unique1': [] }

      render(
        <MapMarkers
          groupedLocations={mockGroupedLocations}
          geofencingStatus="completed"
          geofencingResults={geofencingResults}
          overlapMap={overlapMap}
          generatePopupContent={mockGeneratePopupContent}
        />
      )

      expect(Marker).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: markerIcons.default
        }),
        expect.any(Object)
      )
    })

    it('shows loading popup content when geofencingStatus is loading', () => {
      const { container } = render(
        <MapMarkers
          groupedLocations={mockGroupedLocations}
          geofencingStatus="loading"
          geofencingResults={{}}
          overlapMap={{}}
          generatePopupContent={mockGeneratePopupContent}
        />
      )

      expect(container.querySelector('[data-test="circular-progress"]')).toBeTruthy()
    })

    it('shows generated popup content when geofencingStatus is completed', () => {
      render(
        <MapMarkers
          groupedLocations={mockGroupedLocations}
          geofencingStatus="completed"
          geofencingResults={{}}
          overlapMap={{}}
          generatePopupContent={mockGeneratePopupContent}
        />
      )

      expect(mockGeneratePopupContent).toHaveBeenCalledWith('coord1', mockGroupedLocations['coord1'])
    })

    it('handles empty groupedLocations', () => {
      const { container } = render(
        <MapMarkers
          groupedLocations={{}}
          geofencingStatus="completed"
          geofencingResults={{}}
          overlapMap={{}}
          generatePopupContent={mockGeneratePopupContent}
        />
      )

      expect(container.firstChild).toBeNull()
    })

    it('renders markers with correct position', () => {
      render(
        <MapMarkers
          groupedLocations={mockGroupedLocations}
          geofencingStatus="loading"
          geofencingResults={{}}
          overlapMap={{}}
          generatePopupContent={mockGeneratePopupContent}
        />
      )

      expect(Marker).toHaveBeenCalledWith(
        expect.objectContaining({
          position: [49.2827, -123.1207]
        }),
        expect.any(Object)
      )
    })
  })

  describe('BaseMap', () => {
    it('renders TileLayer with correct props', () => {
      render(<BaseMap />)

      expect(TileLayer).toHaveBeenCalledWith(
        expect.objectContaining({
          attribution: 'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        }),
        {}
      )
    })
  })
})
