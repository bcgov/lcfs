import { handlers } from '@/tests/utils/handlers'
import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { afterEach, vi } from 'vitest'
import { config } from './public/config/config'
import '@/i18n'
import { testQueryClient } from '@/tests/utils/wrapper'
import React from 'react'

configure({ testIdAttribute: 'data-test' })

export const testServer = setupServer(...handlers)

beforeAll(async () => {
  vi.stubGlobal('lcfs_config', config)
  testServer.listen({ onUnhandledRequest: 'bypass' })
  vi.mock('react-snowfall')
  
  // Mock AG Grid enterprise to prevent import errors
  vi.mock('ag-grid-enterprise', () => ({}))
  
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

  // Global component mocks to fix common warnings
  vi.mock('@/components/BCBox', () => ({
    default: React.forwardRef(({ children, jsx, justifyContent, flexWrap, ...props }, ref) => {
      // Filter out non-DOM props that cause warnings
      const { 
        variant, bgColor, color, opacity, borderRadius, shadow, coloredShadow,
        component, ...domProps 
      } = props
      return React.createElement('div', { ref, ...domProps, style: { justifyContent, flexWrap } }, children)
    })
  }))

  vi.mock('@/components/BCAlert', () => ({
    default: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        triggerAlert: vi.fn(),
        show: vi.fn(),
        hide: vi.fn()
      }))
      const { children, severity, dismissible, noFade, delay, ...domProps } = props
      return React.createElement('div', { 'data-test': 'bc-alert', ...domProps, 'data-severity': severity }, children)
    })
  }))

  vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
    BCGridViewer: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        api: vi.fn(),
        columnApi: vi.fn()
      }))
      const { 
        children, jsx, justifyContent, gridRef, gridKey, columnDefs, 
        rowData, defaultColDef, onGridReady, onCellValueChanged,
        ...domProps 
      } = props
      return React.createElement('div', {
        ref,
        ...domProps,
        'data-test': 'bc-grid-container',
        style: { justifyContent }
      }, children)
    })
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
