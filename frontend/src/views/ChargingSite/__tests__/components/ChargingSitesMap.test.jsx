import React from 'react'
import { describe, expect, vi } from 'vitest'
import ChargingSitesMap from '../../components/ChargingSitesMap'
import { test as fixtureTest } from '@/tests/utils/fixtures'

const test = (name, callback) =>
  fixtureTest(name, ({ render, theme, router }) =>
    callback({
      render: (ui, providers = [], options = {}) =>
        render(ui, [theme, router, ...providers], options),
      theme,
      router
    })
  )

// Minimal mocks
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({
    setView: vi.fn(),
    fitBounds: vi.fn(),
    invalidateSize: vi.fn(),
    addControl: vi.fn(),
    removeControl: vi.fn()
  })
}))

vi.mock('react-leaflet-cluster', () => ({
  default: ({ children }) => (
    <div data-testid="marker-cluster-group">{children}</div>
  )
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-dom', () => ({
  createPortal: (children) => children
}))

vi.mock('leaflet', () => ({
  Control: class {
    constructor() {
      this.onAdd = vi.fn()
      this.onRemove = vi.fn()
    }
  },
  DomEvent: {
    disableClickPropagation: vi.fn(),
    disableScrollPropagation: vi.fn()
  },
  DomUtil: { create: vi.fn(() => document.createElement('div')) }
}))

vi.mock('../../components/utils', () => ({
  markerIcons: { default: {}, green: {}, red: {}, orange: {}, grey: {} },
  fixLeafletIcons: vi.fn()
}))

vi.mock('leaflet/dist/leaflet.css', () => ({}))

describe('ChargingSitesMap', () => {
  const mockSites = [
    {
      chargingSiteId: 1,
      siteName: 'Site 1',
      latitude: 49.2827,
      longitude: -123.1207,
      status: { status: 'Validated' },
      organization: { name: 'Org 1' },
      createDate: '2023-01-01',
      updateDate: '2023-01-02',
      createUser: 'User1',
      updateUser: 'User2'
    }
  ]

  test('renders without crashing', ({ render }) => {
    const { container } = render(
      <ChargingSitesMap sites={mockSites} showLegend={false} />
    )
    expect(container).toBeTruthy()
  })

  test('renders empty for no sites', ({ render }) => {
    const { container } = render(<ChargingSitesMap sites={[]} />)
    expect(container.firstChild).toBeNull()
  })

  test('renders site name in DOM', ({ render }) => {
    const { container } = render(
      <ChargingSitesMap sites={mockSites} showLegend={false} />
    )
    expect(container.innerHTML).toContain('Site 1')
  })
})
