import { omitProperties } from './src/utils/omitProperties'
import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vite-plus/test'
import { config } from './public/config/config'
import React from 'react'

interface MockGridApi {
  autoSizeAllColumns: () => void
  sizeColumnsToFit: () => void
  getDisplayedRowAtIndex: (index: number) => unknown
  getRowNode: (id: string) => unknown
  refreshCells: () => void
  setRowData: (rows: unknown[]) => void
  getSelectedRows: () => unknown[]
  deselectAll: () => void
  selectAll: () => void
  stopEditing: () => void
  startEditingCell: () => void
}

interface MockGridColumnApi {
  autoSizeAllColumns: () => void
  sizeColumnsToFit: () => void
  getAllColumns: () => unknown[]
  setColumnVisible: (id: string, visible: boolean) => void
  getColumn: (id: string) => unknown
}

interface MockGridEvent {
  api: Pick<
    MockGridApi,
    | 'autoSizeAllColumns'
    | 'sizeColumnsToFit'
    | 'refreshCells'
    | 'getSelectedRows'
  >
  columnApi?: MockGridColumnApi
  node: {
    setDataValue: (field: string, value: unknown) => void
    updateData: (data: unknown) => void
  }
  data: Record<string, unknown>
  column: { colId: string }
}

interface MockGridHandle {
  api: MockGridApi
  columnApi: MockGridColumnApi
  mockEvent?: MockGridEvent
}

interface MockGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columnDefs?: unknown
  rowData?: unknown
  onCellEditingStopped?: unknown
  defaultColDef?: unknown
  suppressMovableColumns?: boolean
  suppressRowClickSelection?: boolean
  rowSelection?: unknown
  onSelectionChanged?: unknown
  getRowId?: unknown
  suppressNoRowsOverlay?: boolean
  onGridReady?: (event: Pick<MockGridHandle, 'api' | 'columnApi'>) => void
  onCellValueChanged?: (event: MockGridEvent) => void
  loading?: boolean
}

interface MockComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  'data-test'?: string
  jsx?: boolean
  variant?: string
  bgColor?: string
  color?: string
  opacity?: number
  borderRadius?: number | string
  shadow?: number | string
  coloredShadow?: string
  component?: React.ElementType
  justifyContent?: React.CSSProperties['justifyContent']
  flexWrap?: React.CSSProperties['flexWrap']
  dismissible?: boolean
  noFade?: boolean
  delay?: number
  severity?: string
  gridRef?: unknown
  gridKey?: string
  columnDefs?: unknown
  rowData?: unknown
  defaultColDef?: unknown
  onGridReady?: unknown
  onCellValueChanged?: unknown
  onCellEditingStopped?: unknown
  suppressMovableColumns?: boolean
  suppressRowClickSelection?: boolean
  rowSelection?: unknown
  onSelectionChanged?: unknown
  getRowId?: unknown
  suppressNoRowsOverlay?: boolean
}

interface MockAlertHandle {
  triggerAlert: () => void
  show: () => void
  hide: () => void
  clearAlert?: () => void
}

interface MockInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  optional?: boolean
  control?: unknown
  checkbox?: boolean
  checkboxLabel?: string
  onCheckboxChange?: () => void
  isChecked?: boolean
  onSelectAddress?: (address: unknown) => void
  variant?: string
  fullWidth?: boolean
}

interface MockRadioOption {
  value?: string
  dataTestId?: string
}

interface MockRadioProps extends MockComponentProps {
  name: string
  options?: MockRadioOption[]
  control?: unknown
}

interface MockCheckboxOption {
  dataTestId?: string
  label?: React.ReactNode
}

interface MockCheckboxProps {
  name: string
  options?: MockCheckboxOption[]
}

interface MockModalData {
  title?: React.ReactNode
  content?: React.ReactNode
  primaryButtonAction?: () => void
  primaryButtonText?: React.ReactNode
  secondaryButtonText?: string
}

interface MockModalProps {
  open: boolean
  onClose?: () => void
  data?: MockModalData
}

const getGridHandle = (ref: React.ForwardedRef<MockGridHandle>) =>
  ref && typeof ref === 'object' ? (ref.current ?? undefined) : undefined

configure({ testIdAttribute: 'data-test' })

beforeAll(() => {
  vi.stubGlobal('lcfs_config', config)
})

vi.mock('@/i18n', async () => ({
  default: (await import('./src/tests/i18nSetup')).default
}))

vi.mock('react-snowfall')

// Mock AG Grid enterprise to prevent import errors
vi.mock('ag-grid-enterprise', () => ({}))

// Mock ag-grid-react with complete API
vi.mock('ag-grid-react', () => ({
  AgGridReact: React.forwardRef<MockGridHandle, MockGridProps>(
    function GridMock(props, ref) {
      const api = React.useMemo<MockGridApi>(
        () => ({
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
        }),
        []
      )
      const columnApi = React.useMemo<MockGridColumnApi>(
        () => ({
          autoSizeAllColumns: vi.fn(),
          sizeColumnsToFit: vi.fn(),
          getAllColumns: vi.fn(() => []),
          setColumnVisible: vi.fn(),
          getColumn: vi.fn()
        }),
        []
      )
      const elementRef = React.useRef<HTMLDivElement>(null)

      const { onGridReady, onCellValueChanged, loading, ...domProps } =
        omitProperties(props, [
          'columnDefs',
          'rowData',
          'onCellEditingStopped',
          'defaultColDef',
          'suppressMovableColumns',
          'suppressRowClickSelection',
          'rowSelection',
          'onSelectionChanged',
          'getRowId',
          'suppressNoRowsOverlay'
        ])

      React.useImperativeHandle(ref, () => ({ api, columnApi }), [
        api,
        columnApi
      ])

      React.useEffect(() => {
        const handle = getGridHandle(ref)
        if (onGridReady && handle) {
          onGridReady({ api: handle.api, columnApi: handle.columnApi })
        }
      }, [onGridReady, ref])

      React.useEffect(() => {
        if (!onCellValueChanged) return

        const handle = getGridHandle(ref)
        const mockEvent: MockGridEvent = {
          api: handle?.api ?? {
            autoSizeAllColumns: vi.fn(),
            refreshCells: vi.fn(),
            getSelectedRows: vi.fn(() => []),
            sizeColumnsToFit: vi.fn()
          },
          columnApi: handle?.columnApi,
          node: {
            setDataValue: vi.fn(),
            updateData: vi.fn()
          },
          data: {},
          column: { colId: 'test' }
        }

        if (handle) handle.mockEvent = mockEvent
      }, [onCellValueChanged, ref])

      return React.createElement(
        'div',
        {
          ref: elementRef,
          ...domProps,
          'data-test': 'ag-grid',
          'data-loading': loading || false
        },
        'AgGrid Mock'
      )
    }
  )
}))

// Mock problematic leaflet components
vi.mock('react-leaflet-custom-control', () => ({
  default: ({ children }: { children?: React.ReactNode }) => children
}))

vi.mock('react-leaflet-cluster', () => ({
  default: ({ children }: { children?: React.ReactNode }) => children
}))

vi.mock('react-leaflet', () => ({
  useMap: () => ({
    fitBounds: vi.fn()
  }),
  Marker: ({ children }: { children?: React.ReactNode }) => children,
  Popup: ({ children }: { children?: React.ReactNode }) => children,
  TileLayer: () => null
}))

// Global component mocks to fix common warnings
vi.mock('@/components/BCBox', () => ({
  default: React.forwardRef<HTMLDivElement, MockComponentProps>(
    function BoxMock({ children, justifyContent, flexWrap, ...props }, ref) {
      delete props.jsx

      // Filter out non-DOM props that cause warnings
      const { ...domProps } = omitProperties(props, [
        'variant',
        'bgColor',
        'color',
        'opacity',
        'borderRadius',
        'shadow',
        'coloredShadow',
        'component'
      ])
      return React.createElement(
        'div',
        { ref, ...domProps, style: { justifyContent, flexWrap } },
        children
      )
    }
  )
}))

vi.mock('@/components/BCAlert', () => ({
  default: React.forwardRef<MockAlertHandle, MockComponentProps>(
    function AlertMock(props, ref) {
      React.useImperativeHandle(ref, () => ({
        triggerAlert: vi.fn(),
        show: vi.fn(),
        hide: vi.fn()
      }))
      const { children, severity, ...domProps } = omitProperties(props, [
        'dismissible',
        'noFade',
        'delay'
      ])
      return React.createElement(
        'div',
        { 'data-test': 'bc-alert', ...domProps, 'data-severity': severity },
        children
      )
    }
  ),
  BCAlert2: React.forwardRef<MockAlertHandle, MockComponentProps>(
    function Alert2Mock(props, ref) {
      React.useImperativeHandle(ref, () => ({
        triggerAlert: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
        clearAlert: vi.fn()
      }))
      const { children, severity, ...domProps } = omitProperties(props, [
        'dismissible',
        'noFade',
        'delay'
      ])
      const testId = domProps['data-test'] || 'bc-alert-2'
      return React.createElement(
        'div',
        { 'data-test': testId, ...domProps, 'data-severity': severity },
        children
      )
    }
  ),
  FloatingAlert: React.forwardRef<MockAlertHandle, MockComponentProps>(
    function FloatingAlertMock(props, ref) {
      React.useImperativeHandle(ref, () => ({
        triggerAlert: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
        clearAlert: vi.fn()
      }))
      const { children, severity, ...domProps } = omitProperties(props, [
        'dismissible',
        'noFade',
        'delay'
      ])
      return React.createElement(
        'div',
        {
          'data-test': 'floating-alert',
          ...domProps,
          'data-severity': severity
        },
        children
      )
    }
  )
}))

vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: React.forwardRef<
    {
      api: () => void
      columnApi: () => void
    },
    MockComponentProps
  >(function GridViewerMock(props, ref) {
    React.useImperativeHandle(ref, () => ({
      api: vi.fn(),
      columnApi: vi.fn()
    }))
    const { children, justifyContent, ...domProps } = omitProperties(props, [
      'jsx',
      'gridRef',
      'gridKey',
      'columnDefs',
      'rowData',
      'defaultColDef',
      'onGridReady',
      'onCellValueChanged'
    ])
    return React.createElement(
      'div',
      {
        ...domProps,
        'data-test': 'bc-grid-container',
        style: { justifyContent }
      },
      children
    )
  })
}))

// Mock form components
vi.mock('@/components/BCForm/BCFormText', () => ({
  BCFormText: ({
    name,
    label,
    optional,
    disabled,
    ...props
  }: MockInputProps & { name: string }) => {
    delete props.control
    delete props.checkbox
    delete props.checkboxLabel
    delete props.onCheckboxChange
    delete props.isChecked

    const { variant, fullWidth, ...domProps } = props
    // Create a properly labeled input that Testing Library can find by accessible name
    // Also handle form values correctly for React Hook Form integration
    return React.createElement('input', {
      id: name,
      name,
      'data-test': name,
      'data-testid': name,
      'data-variant': variant || 'outlined',
      'data-fullwidth': fullWidth || true,
      required: !optional,
      disabled,
      'aria-label': label, // This provides the accessible name
      placeholder: label, // Also add as placeholder for additional context
      ...domProps
    })
  }
}))

vi.mock('@/components/BCForm/BCFormRadio', () => ({
  BCFormRadio: ({ name, options = [], ...props }: MockRadioProps) => {
    delete props.control

    return React.createElement(
      'div',
      { 'data-test': `${name}-radio-group` },
      options.map((option, index) =>
        React.createElement('input', {
          key: `${name}-${index}`,
          type: 'radio',
          name,
          value: option.value || String(option),
          'data-testid': option.dataTestId || `${name}${index + 1}`,
          'data-test': option.dataTestId || `${name}${index + 1}`
        })
      )
    )
  }
}))

vi.mock('@/components/BCForm/BCFormCheckbox', () => ({
  BCFormCheckbox: ({ name, options = [] }: MockCheckboxProps) => {
    return React.createElement(
      'div',
      { 'data-test': `${name}-checkbox-group` },
      options.map((option, index) =>
        React.createElement(
          'label',
          { key: `${name}-${index}` },
          React.createElement('input', {
            type: 'checkbox',
            'data-test': option.dataTestId || `${name}${index + 1}`,
            'data-testid': option.dataTestId || `${name}${index + 1}`
          }),
          option.label
        )
      )
    )
  }
}))

vi.mock('@/components/BCForm/BCFormAddressAutocomplete', () => ({
  BCFormAddressAutocomplete: ({
    name,
    label,
    disabled,
    ...props
  }: MockInputProps & { name: string }) => {
    delete props.control
    delete props.checkbox
    delete props.checkboxLabel
    delete props.onCheckboxChange
    delete props.isChecked
    delete props.onSelectAddress

    return React.createElement('input', {
      'data-test': name,
      'data-name': name,
      'aria-label': label,
      placeholder: label,
      disabled,
      defaultValue: '',
      ...props
    })
  }
}))

// Mock BCModal
vi.mock('@/components/BCModal', () => ({
  default: ({ open, onClose, data }: MockModalProps) => {
    if (!open || !data) return null
    return React.createElement(
      'div',
      { 'data-test': 'modal', role: 'dialog' },
      [
        React.createElement('div', { key: 'title' }, data.title),
        React.createElement('div', { key: 'content' }, data.content),
        React.createElement(
          'button',
          {
            key: 'primary',
            onClick: data.primaryButtonAction,
            role: 'button'
          },
          data.primaryButtonText || 'Confirm'
        ),
        React.createElement(
          'button',
          {
            key: 'secondary',
            onClick: onClose,
            role: 'button',
            'aria-label': data.secondaryButtonText || 'Cancel'
          },
          data.secondaryButtonText || 'Cancel'
        )
      ]
    )
  }
}))

// Mock AddressAutocomplete component
vi.mock('@/components/BCForm/AddressAutocomplete', () => ({
  AddressAutocomplete: ({
    name,
    ...props
  }: MockInputProps & { name: string }) => {
    return React.createElement('input', {
      'data-test': 'address-autocomplete',
      'data-name': name,
      defaultValue: '',
      ...props
    })
  }
}))

afterEach(() => {
  cleanup()
})
