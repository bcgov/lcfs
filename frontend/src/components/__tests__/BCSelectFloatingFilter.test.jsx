import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BCSelectFloatingFilter } from '../BCDataGrid/components'

describe('BCSelectFloatingFilter', () => {
  const mockOnModelChange = vi.fn()
  const defaultProps = {
    model: null,
    onModelChange: mockOnModelChange,
    optionsQuery: () => ({
      data: [
        { value: '1', label: 'Option 1' },
        { value: '2', label: 'Option 2' },
        { value: '3', label: 'Option 3' }
      ],
      isLoading: false,
      isError: false,
      error: null
    }),
    valueKey: 'value',
    labelKey: 'label',
    disabled: false,
    params: {},
    initialFilterType: 'equals',
    multiple: false,
    initialSelectedValues: []
  }

  beforeEach(() => {
    mockOnModelChange.mockClear()
  })

  it('renders with default props', () => {
    render(<BCSelectFloatingFilter {...defaultProps} />)

    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect(screen.getByText('Select')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(4) // Including the default "Select" option
  })

  it('handles single selection', async () => {
    render(<BCSelectFloatingFilter {...defaultProps} />)

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '1' } })

    expect(mockOnModelChange).toHaveBeenCalledWith({
      type: 'equals',
      filter: '1'
    })
  })

  it('handles multiple selection when multiple prop is true', () => {
    render(<BCSelectFloatingFilter {...defaultProps} multiple={true} />)

    const select = screen.getByRole('combobox')
    fireEvent.change(select, {
      target: {
        options: [
          { selected: true, value: '1' },
          { selected: true, value: '2' }
        ]
      }
    })

    expect(mockOnModelChange).toHaveBeenCalledWith({
      type: 'equals',
      filter: ['1', '2']
    })
  })

  it('shows loading state', () => {
    const loadingProps = {
      ...defaultProps,
      optionsQuery: () => ({
        data: null,
        isLoading: true,
        isError: false,
        error: null
      })
    }

    render(<BCSelectFloatingFilter {...loadingProps} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows error state', () => {
    const errorProps = {
      ...defaultProps,
      optionsQuery: () => ({
        data: null,
        isLoading: false,
        isError: true,
        error: { message: 'Failed to load' }
      })
    }

    render(<BCSelectFloatingFilter {...errorProps} />)
    expect(
      screen.getByText('Error loading options: Failed to load')
    ).toBeInTheDocument()
  })

  it('clears selection when clear button is clicked', async () => {
    render(<BCSelectFloatingFilter {...defaultProps} />)

    // First select a value
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '1' } })

    // Then clear it
    const clearButton = screen.getByLabelText('Clear selection')
    fireEvent.click(clearButton)

    expect(mockOnModelChange).toHaveBeenLastCalledWith(null)
  })

  it('initializes with model value when provided', () => {
    const modelProps = {
      ...defaultProps,
      model: { type: 'equals', filter: '2' }
    }

    render(<BCSelectFloatingFilter {...modelProps} />)
    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('2')
  })

  it('initializes with initialSelectedValues when provided', () => {
    const initialValueProps = {
      ...defaultProps,
      initialSelectedValues: ['1']
    }

    render(<BCSelectFloatingFilter {...initialValueProps} />)
    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('1')
  })

  it('disables select when disabled prop is true', () => {
    render(<BCSelectFloatingFilter {...defaultProps} disabled={true} />)
    const select = screen.getByRole('combobox')
    expect(select).toBeDisabled()
  })

  it('handles empty/null selection in single select mode', () => {
    render(<BCSelectFloatingFilter {...defaultProps} />)

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '0' } })

    expect(mockOnModelChange).toHaveBeenCalledWith(null)
  })

  it('maintains proper ARIA attributes', () => {
    render(<BCSelectFloatingFilter {...defaultProps} />)

    const container = screen.getByRole('group')
    expect(container).toHaveAttribute('aria-labelledby', 'select-filter-label')

    const combobox = screen.getByRole('combobox')
    expect(combobox).toHaveAttribute('aria-controls', 'select-filter')
    expect(combobox).toHaveAttribute('aria-expanded', 'false')
  })
})
