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
  
  // Mock ag-grid-react with complete API
  vi.mock('ag-grid-react', () => ({
    AgGridReact: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        api: {
          autoSizeAllColumns: vi.fn(),
          sizeColumnsToFit: vi.fn(),
          getDisplayedRowAtIndex: vi.fn(),
          getRowNode: vi.fn(),
          refreshCells: vi.fn(),
          setRowData: vi.fn(),
          getSelectedRows: vi.fn(),
          deselectAll: vi.fn(),
          selectAll: vi.fn(),
          stopEditing: vi.fn(),
          startEditingCell: vi.fn()
        },
        columnApi: {
          autoSizeAllColumns: vi.fn(),
          sizeColumnsToFit: vi.fn(),
          getAllColumns: vi.fn(() => []),
          setColumnVisible: vi.fn(),
          getColumn: vi.fn()
        }
      }))
      
      const { 
        columnDefs, rowData, onGridReady, onCellValueChanged, onCellEditingStopped,
        defaultColDef, suppressMovableColumns, suppressRowClickSelection,
        rowSelection, onSelectionChanged, getRowId, loading, suppressNoRowsOverlay,
        ...domProps 
      } = props

      React.useEffect(() => {
        if (onGridReady && ref?.current) {
          onGridReady({
            api: ref.current.api,
            columnApi: ref.current.columnApi
          })
        }
      }, [onGridReady])

      // Also trigger cell value changed callbacks with proper API
      React.useEffect(() => {
        if (onCellValueChanged) {
          // Mock cell change events should include our API
          const mockEvent = {
            api: ref?.current?.api || {
              autoSizeAllColumns: vi.fn(),
              refreshCells: vi.fn(),
              getSelectedRows: vi.fn(() => []),
              sizeColumnsToFit: vi.fn()
            },
            columnApi: ref?.current?.columnApi,
            node: {
              setDataValue: vi.fn(),
              updateData: vi.fn()
            },
            data: {},
            column: { colId: 'test' }
          }
          // Store this for tests that need to trigger events manually
          if (ref?.current) {
            ref.current.mockEvent = mockEvent
          }
        }
      }, [onCellValueChanged])
      
      return React.createElement('div', {
        ref,
        ...domProps,
        'data-test': 'ag-grid',
        'data-loading': loading || false
      }, 'AgGrid Mock')
    })
  }))
  
  // Mock problematic leaflet components
  vi.mock('react-leaflet-custom-control', () => ({
    default: ({ children }) => children
  }))

  vi.mock('react-leaflet-cluster', () => ({
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
    }),
    BCAlert2: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        triggerAlert: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
        clearAlert: vi.fn()
      }))
      const { children, severity, dismissible, noFade, delay, ...domProps } = props
      const testId = domProps['data-test'] || 'bc-alert-2'
      return React.createElement('div', { 'data-test': testId, ...domProps, 'data-severity': severity }, children)
    }),
    FloatingAlert: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        triggerAlert: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
        clearAlert: vi.fn()
      }))
      const { children, severity, dismissible, noFade, delay, ...domProps } = props
      return React.createElement('div', { 'data-test': 'floating-alert', ...domProps, 'data-severity': severity }, children)
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

  // Mock form components
  vi.mock('@/components/BCForm', () => ({
    BCFormText: ({ name, control, label, optional, checkbox, checkboxLabel, onCheckboxChange, isChecked, disabled, ...props }) => {
      const { variant, fullWidth, ...domProps } = props
      // Create a properly labeled input that Testing Library can find by accessible name
      // Also handle form values correctly for React Hook Form integration
      return React.createElement('input', {
        id: name,
        name: name,
        'data-test': name,
        'data-testid': name,
        'data-variant': variant || 'outlined',
        'data-fullwidth': fullWidth || true,
        required: !optional,
        disabled: disabled,
        'aria-label': label, // This provides the accessible name
        placeholder: label, // Also add as placeholder for additional context
        ...domProps
      })
    },
    BCFormRadio: ({ name, control, options = [], ...props }) => {
      return React.createElement(
        'div',
        { 'data-test': `${name}-radio-group` },
        options.map((option, index) =>
          React.createElement('input', {
            key: `${name}-${index}`,
            type: 'radio',
            name: name,
            value: option.value || option,
            'data-testid': option.dataTestId || `${name}${index + 1}`,
            'data-test': option.dataTestId || `${name}${index + 1}`
          })
        )
      )
    },
    BCFormCheckbox: ({ name, form, options = [], ...props }) => {
      return React.createElement('div', { 'data-test': `${name}-checkbox-group` },
        options.map((option, index) =>
          React.createElement('input', {
            key: `${name}-${index}`,
            type: 'checkbox',
            'data-test': option.dataTestId || `${name}${index + 1}`,
            'data-testid': option.dataTestId || `${name}${index + 1}`
          })
        )
      )
    },
    BCFormAddressAutocomplete: ({ name, control, label, checkbox, checkboxLabel, onCheckboxChange, isChecked, disabled, onSelectAddress, ...props }) => {
      return React.createElement('input', {
        'data-test': name,
        'data-name': name,
        'aria-label': label,
        placeholder: label,
        disabled: disabled,
        defaultValue: '',
        ...props
      })
    }
  }))

  // Mock BCModal
  vi.mock('@/components/BCModal', () => ({
    default: ({ open, onClose, data }) => {
      if (!open || !data) return null
      return React.createElement('div', 
        { 'data-test': 'modal', 'role': 'dialog' },
        [
          React.createElement('div', { key: 'title' }, data.title),
          React.createElement('div', { key: 'content' }, data.content),
          React.createElement('button', { 
            key: 'primary', 
            onClick: data.primaryButtonAction,
            'role': 'button'
          }, data.primaryButtonText || 'Confirm'),
          React.createElement('button', { 
            key: 'secondary', 
            onClick: onClose,
            'role': 'button',
            'aria-label': data.secondaryButtonText || 'Cancel'
          }, data.secondaryButtonText || 'Cancel')
        ]
      )
    }
  }))

  // Mock AddressAutocomplete component
  vi.mock('@/components/BCForm/AddressAutocomplete', () => ({
    default: ({ name, ...props }) => {
      return React.createElement('input', {
        'data-test': 'address-autocomplete',
        'data-name': name,
        defaultValue: '',
        ...props
      })
    }
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
