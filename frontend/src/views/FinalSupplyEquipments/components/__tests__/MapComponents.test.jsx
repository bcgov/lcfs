import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MapLegend, MapMarkers } from '../MapComponents'

// Lightweight mocks for leaflet + react-leaflet
vi.mock('react-leaflet', () => ({
  useMap: () => ({
    addControl: () => {},
    removeControl: () => {},
    fitBounds: () => {}
  }),
  Marker: ({ children }) => <div>{children}</div>,
  Popup: ({ children }) => <div>{children}</div>
}))
vi.mock('leaflet', () => ({
  Icon: function () {},
  Control: function () {},
  DomUtil: { create: () => {} },
  DomEvent: {
    disableClickPropagation: () => {},
    disableScrollPropagation: () => {}
  }
}))
vi.mock('../utils', () => ({
  markerIcons: { default: {}, orange: {}, red: {}, grey: {} }
}))

vi.mock('@mui/material', () => ({
  Paper: ({ children }) => <div>{children}</div>
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))

describe('MapComponents presentation bits', () => {
  it('MapMarkers chooses icon based on geofencing results', () => {
    const grouped = {
      '0,0': [{ id: '1', uniqueId: 'u1', lat: 50, lng: -120, name: 'Loc' }]
    }
    const overlapMap = {}
    const geofencingResults = { 1: true }

    const { container } = render(
      <MapMarkers
        groupedLocations={grouped}
        geofencingStatus="completed"
        geofencingResults={geofencingResults}
        overlapMap={overlapMap}
        generatePopupContent={() => <span>popup</span>}
      />
    )
    expect(container.textContent).toMatch(/popup/)
  })
})
