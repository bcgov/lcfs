import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  useLocation: () => ({ pathname: '/test' })
}))

describe('YesNoTextRenderer', () => {
  it('renders "Yes" when value is true', () => {
    render(<YesNoTextRenderer value={true} />, { wrapper })
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('renders "No" when value is false', () => {
    render(<YesNoTextRenderer value={false} />, { wrapper })
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('renders "No" when value is falsy', () => {
    render(<YesNoTextRenderer value={0} />, { wrapper })
    expect(screen.getByText('No')).toBeInTheDocument()
  })
})

describe('TextRenderer', () => {
  it('renders value', () => {
    render(<TextRenderer value="Test Text" />, { wrapper })
    expect(screen.getByText('Test Text')).toBeInTheDocument()
  })

  it('renders formatted value', () => {
    render(<TextRenderer valueFormatted="Formatted" value="Raw" />, { wrapper })
    expect(screen.getByText('Formatted')).toBeInTheDocument()
  })
})

describe('LinkRenderer', () => {
  it('renders link with value', () => {
    const props = { value: 'Link Text', node: { id: '123' } }
    render(<LinkRenderer {...props} />, { wrapper })
    expect(screen.getByText('Link Text')).toBeInTheDocument()
  })

  it('uses custom url function', () => {
    const props = {
      value: 'Link',
      url: ({ data }) => `custom/${data.id}`,
      data: { id: '456' }
    }
    render(<LinkRenderer {...props} />, { wrapper })
    expect(screen.getByRole('link')).toHaveAttribute('href', '/test/custom/456')
  })
})

describe('SelectRenderer', () => {
  it('renders select with value', () => {
    const props = {
      value: 'Selected',
      colDef: {
        cellEditorParams: { options: ['A', 'B'] },
        editable: true
      }
    }
    render(<SelectRenderer {...props} />, { wrapper })
    expect(screen.getByText('Selected')).toBeInTheDocument()
  })

  it('shows Select placeholder when no value', () => {
    const props = {
      colDef: {
        cellEditorParams: { options: ['A', 'B'] },
        editable: true
      }
    }
    render(<SelectRenderer {...props} />, { wrapper })
    expect(screen.getByText('Select')).toBeInTheDocument()
  })
})

describe('MultiSelectRenderer', () => {
  it('renders array values', () => {
    const props = {
      value: [{ label: 'Item 1' }, { label: 'Item 2' }],
      colDef: { cellEditorParams: { options: [] } }
    }
    render(<MultiSelectRenderer {...props} />, { wrapper })
    expect(screen.getByText('Item 1')).toBeInTheDocument()
  })
})

describe('StatusRenderer', () => {
  it('renders active status', () => {
    const props = { data: { isActive: true } }
    render(<StatusRenderer {...props} />, { wrapper })
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders inactive status', () => {
    const props = { data: { isActive: false } }
    render(<StatusRenderer {...props} />, { wrapper })
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })
})

describe('CommonArrayRenderer', () => {
  it('renders array of strings', () => {
    const props = {
      value: ['Item 1', 'Item 2'],
      colDef: { field: 'test' },
      api: { addEventListener: vi.fn(), removeEventListener: vi.fn() }
    }
    render(<CommonArrayRenderer {...props} />, { wrapper })
    expect(screen.getByText('Item 1')).toBeInTheDocument()
  })

  it('handles empty array', () => {
    const props = {
      value: [],
      colDef: { field: 'test' },
      api: { addEventListener: vi.fn(), removeEventListener: vi.fn() }
    }
    const { container } = render(<CommonArrayRenderer {...props} />, { wrapper })
    expect(container.firstChild).toBeInTheDocument()
  })
})

describe('ChargingSiteStatusRenderer', () => {
  it('renders draft status', () => {
    const props = { data: { status: { status: 'Draft' } } }
    render(<ChargingSiteStatusRenderer {...props} />, { wrapper })
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('renders validated status', () => {
    const props = { data: { status: { status: 'Validated' } } }
    render(<ChargingSiteStatusRenderer {...props} />, { wrapper })
    expect(screen.getByText('Validated')).toBeInTheDocument()
  })
})

describe('createStatusRenderer', () => {
  it('creates custom status renderer', () => {
    const colorMap = { Active: 'success', Inactive: 'error' }
    const CustomRenderer = createStatusRenderer(colorMap, { statusField: 'customStatus' })
    
    const props = { data: { customStatus: 'Active' } }
    render(<CustomRenderer {...props} />, { wrapper })
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('handles nested status field', () => {
    const colorMap = { Draft: 'info' }
    const CustomRenderer = createStatusRenderer(colorMap, { statusField: 'status.value' })
    
    const props = { data: { status: { value: 'Draft' } } }
    render(<CustomRenderer {...props} />, { wrapper })
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })
})
