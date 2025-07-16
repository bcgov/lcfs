import { handlers } from '@/tests/utils/handlers'
import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { afterEach, vi } from 'vitest'
import { config } from './public/config/config'
import '@/i18n'
import { testQueryClient } from '@/tests/utils/wrapper'

configure({ testIdAttribute: 'data-test' })

export const testServer = setupServer(...handlers)

beforeAll(async () => {
  vi.stubGlobal('lcfs_config', config)
  testServer.listen({ onUnhandledRequest: 'bypass' })
  vi.mock('react-snowfall')
  
  // Mock problematic leaflet components
  vi.mock('react-leaflet-custom-control', () => ({
    default: ({ children }) => children
  }))
  
  vi.mock('react-leaflet', () => ({
    useMap: () => ({
      fitBounds: vi.fn()
    }),
    Marker: ({ children }) => children,
    Popup: ({ children }) => children,
    TileLayer: () => null
  }))
})

afterEach(() => {
  cleanup()
  testQueryClient.clear()
  testServer.resetHandlers()
})

afterAll(() => {
  testServer.close()
})
