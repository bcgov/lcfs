import { describe, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import {
  YesNoTextRenderer,
  TextRenderer,
  LinkRenderer,
  SelectRenderer,
  MultiSelectRenderer,
  StatusRenderer,
  CommonArrayRenderer,
  ChargingSiteStatusRenderer,
  createStatusRenderer
} from '../grid/cellRenderers'
import { test } from '@/tests/utils/fixtures'

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(function () {
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }
})

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  useLocation: () => ({ pathname: '/test' })
}))

describe('YesNoTextRenderer', () => {
  test('renders "Yes" when value is true', ({ render }) => {
    render(<YesNoTextRenderer value={true} />, [])
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  test('renders "No" when value is false', ({ render }) => {
    render(<YesNoTextRenderer value={false} />, [])
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  test('renders "No" when value is falsy', ({ render }) => {
    render(<YesNoTextRenderer value={0} />, [])
    expect(screen.getByText('No')).toBeInTheDocument()
  })
})

describe('TextRenderer', () => {
  test('renders value', ({ render }) => {
    render(<TextRenderer value="Test Text" />, [])
    expect(screen.getByText('Test Text')).toBeInTheDocument()
  })

  test('renders formatted value', ({ render }) => {
    render(<TextRenderer valueFormatted="Formatted" value="Raw" />, [])
    expect(screen.getByText('Formatted')).toBeInTheDocument()
  })
})

describe('LinkRenderer', () => {
  test('renders link with value', ({ render }) => {
    const props = { value: 'Link Text', node: { id: '123' } }
    render(<LinkRenderer {...props} />, [])
    expect(screen.getByText('Link Text')).toBeInTheDocument()
  })

  test('uses custom url function', ({ render }) => {
    const props = {
      value: 'Link',
      url: ({ data }) => `custom/${data.id}`,
      data: { id: '456' }
    }
    render(<LinkRenderer {...props} />, [])
    expect(screen.getByRole('link')).toHaveAttribute('href', '/test/custom/456')
  })
})

describe('SelectRenderer', () => {
  test('renders select with value', ({ render }) => {
    const props = {
      value: 'Selected',
      colDef: {
        cellEditorParams: { options: ['A', 'B'] },
        editable: true
      }
    }
    render(<SelectRenderer {...props} />, [])
    expect(screen.getByText('Selected')).toBeInTheDocument()
  })

  test('shows Select placeholder when no value', ({ render }) => {
    const props = {
      colDef: {
        cellEditorParams: { options: ['A', 'B'] },
        editable: true
      }
    }
    render(<SelectRenderer {...props} />, [])
    expect(screen.getByText('Select')).toBeInTheDocument()
  })
})

describe('MultiSelectRenderer', () => {
  test('renders array values', ({ render }) => {
    const props = {
      value: [{ label: 'Item 1' }, { label: 'Item 2' }],
      colDef: { cellEditorParams: { options: [] } }
    }
    render(<MultiSelectRenderer {...props} />, [])
    expect(screen.getByText('Item 1')).toBeInTheDocument()
  })
})

describe('StatusRenderer', () => {
  test('renders active status', ({ render, theme }) => {
    const props = { data: { isActive: true } }
    render(<StatusRenderer {...props} />, [theme])
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  test('renders inactive status', ({ render, theme }) => {
    const props = { data: { isActive: false } }
    render(<StatusRenderer {...props} />, [theme])
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })
})

describe('CommonArrayRenderer', () => {
  test('renders array of strings', ({ render }) => {
    const props = {
      value: ['Item 1', 'Item 2'],
      colDef: { field: 'test' },
      api: { addEventListener: vi.fn(), removeEventListener: vi.fn() }
    }
    render(<CommonArrayRenderer {...props} />, [])
    expect(screen.getByText('Item 1')).toBeInTheDocument()
  })

  test('handles empty array', ({ render }) => {
    const props = {
      value: [],
      colDef: { field: 'test' },
      api: { addEventListener: vi.fn(), removeEventListener: vi.fn() }
    }
    const { container } = render(<CommonArrayRenderer {...props} />, [])
    expect(container.firstChild).toBeInTheDocument()
  })
})

describe('ChargingSiteStatusRenderer', () => {
  test('renders draft status', ({ render, theme }) => {
    const props = { data: { status: { status: 'Draft' } } }
    render(<ChargingSiteStatusRenderer {...props} />, [theme])
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  test('renders validated status', ({ render, theme }) => {
    const props = { data: { status: { status: 'Validated' } } }
    render(<ChargingSiteStatusRenderer {...props} />, [theme])
    expect(screen.getByText('Validated')).toBeInTheDocument()
  })
})

describe('createStatusRenderer', () => {
  test('creates custom status renderer', ({ render, theme }) => {
    const colorMap = { Active: 'success', Inactive: 'error' }
    const CustomRenderer = createStatusRenderer(colorMap, {
      statusField: 'customStatus'
    })

    const props = { data: { customStatus: 'Active' } }
    render(<CustomRenderer {...props} />, [theme])
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  test('handles nested status field', ({ render, theme }) => {
    const colorMap = { Draft: 'info' }
    const CustomRenderer = createStatusRenderer(colorMap, {
      statusField: 'status.value'
    })

    const props = { data: { status: { value: 'Draft' } } }
    render(<CustomRenderer {...props} />, [theme])
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })
})
