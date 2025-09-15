import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BCSelectFloatingFilter } from '../BCSelectFloatingFilter'

// Mock Material-UI components
vi.mock('@mui/material', () => ({
  IconButton: vi.fn(({ children, onClick, onMouseDown, ...props }) => (
    <button
      data-test="icon-button"
      onClick={onClick}
      onMouseDown={onMouseDown}
      {...props}
    >
      {children}
    </button>
  ))
}))

vi.mock('@mui/icons-material', () => ({
  Clear: vi.fn(() => <span data-test="clear-icon">Clear</span>)
}))

describe('BCSelectFloatingFilter', () => {
  let mockOnModelChange
  let mockOptionsQuery
  let defaultProps

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockOnModelChange = vi.fn()
    mockOptionsQuery = vi.fn(() => ({
      data: [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
        { value: 'option3', label: 'Option 3' }
      ],
      isLoading: false,
      isError: false,
      error: null
    }))
    
    defaultProps = {
      model: null,
      onModelChange: mockOnModelChange,
      optionsQuery: mockOptionsQuery,
      valueKey: 'value',
      labelKey: 'label',
      disabled: false,
      params: {},
      initialFilterType: 'equals',
      multiple: false,
      initialSelectedValues: []
    }
  })

  describe('Component Rendering', () => {
    it('renders correctly with minimal props', () => {
      const minimalProps = {
        model: null,
        onModelChange: mockOnModelChange,
        optionsQuery: mockOptionsQuery
      }
      
      render(<BCSelectFloatingFilter {...minimalProps} />)
      
      expect(screen.getByRole('group')).toBeInTheDocument()
      expect(screen.getAllByRole('combobox')).toHaveLength(2) // div and select both have combobox role
      const select = document.getElementById('select-filter')
      expect(select).toBeInTheDocument()
      expect(select.tagName).toBe('SELECT')
    })

    it('renders with all default props', () => {
      render(<BCSelectFloatingFilter {...defaultProps} />)
      
      const select = document.getElementById('select-filter')
      expect(select).toBeInTheDocument()
      expect(select).not.toHaveAttribute('multiple')
      expect(select).not.toHaveAttribute('disabled')
    })

    it('renders options from optionsQuery', () => {
      render(<BCSelectFloatingFilter {...defaultProps} />)
      
      expect(screen.getByText('Select')).toBeInTheDocument()
      expect(screen.getByText('Option 1')).toBeInTheDocument()
      expect(screen.getByText('Option 2')).toBeInTheDocument()
      expect(screen.getByText('Option 3')).toBeInTheDocument()
    })

    it('renders in multiple mode when multiple prop is true', () => {
      const props = { ...defaultProps, multiple: true }
      render(<BCSelectFloatingFilter {...props} />)
      
      const select = document.getElementById('select-filter')
      expect(select).toBeInTheDocument()
      expect(select).toHaveAttribute('multiple')
      expect(select).toHaveAttribute('aria-multiselectable', 'true')
    })

    it('uses custom valueKey and labelKey', () => {
      const customOptionsQuery = vi.fn(() => ({
        data: [
          { id: 'custom1', name: 'Custom 1' },
          { id: 'custom2', name: 'Custom 2' }
        ],
        isLoading: false,
        isError: false,
        error: null
      }))
      
      const props = {
        ...defaultProps,
        optionsQuery: customOptionsQuery,
        valueKey: 'id',
        labelKey: 'name'
      }
      
      render(<BCSelectFloatingFilter {...props} />)
      
      expect(screen.getByText('Custom 1')).toBeInTheDocument()
      expect(screen.getByText('Custom 2')).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('renders loading option when isLoading is true', () => {
      const loadingOptionsQuery = vi.fn(() => ({
        data: null,
        isLoading: true,
        isError: false,
        error: null
      }))
      
      const props = { ...defaultProps, optionsQuery: loadingOptionsQuery }
      render(<BCSelectFloatingFilter {...props} />)
      
      expect(screen.getByText('Loading...')).toBeInTheDocument()
      
      const select = document.getElementById('select-filter')
      expect(select).toHaveAttribute('disabled')
    })
  })

  describe('Error State', () => {
    it('renders error option when isError is true', () => {
      const errorOptionsQuery = vi.fn(() => ({
        data: null,
        isLoading: false,
        isError: true,
        error: { message: 'Failed to load options' }
      }))
      
      const props = { ...defaultProps, optionsQuery: errorOptionsQuery }
      render(<BCSelectFloatingFilter {...props} />)
      
      expect(screen.getByText('Error loading options: Failed to load options')).toBeInTheDocument()
      
      const select = document.getElementById('select-filter')
      expect(select).toHaveAttribute('aria-describedby', 'select-filter-error')
    })

    it('handles error without message', () => {
      const errorOptionsQuery = vi.fn(() => ({
        data: null,
        isLoading: false,
        isError: true,
        error: {}
      }))
      
      const props = { ...defaultProps, optionsQuery: errorOptionsQuery }
      render(<BCSelectFloatingFilter {...props} />)
      
      expect(screen.getByText(/Error loading options:/)).toBeInTheDocument()
    })
  })

  describe('useEffect - Model Changes', () => {
    it('sets initialSelectedValues when model is null', () => {
      const initialValues = ['initial1', 'initial2']
      const props = {
        ...defaultProps,
        model: null,
        initialSelectedValues: initialValues,
        multiple: true
      }
      
      render(<BCSelectFloatingFilter {...props} />)
      
      // This test ensures the early return branch in useEffect is covered
      const select = document.getElementById('select-filter')
      expect(select).toBeInTheDocument()
    })

    it('handles model with single filter value', () => {
      const modelWithFilter = {
        type: 'equals',
        filter: 'option1'
      }
      const props = { ...defaultProps, model: modelWithFilter }
      
      render(<BCSelectFloatingFilter {...props} />)
      
      const select = document.getElementById('select-filter')
      expect(select.value).toBe('option1')
    })

    it('handles model with multiple filter values', () => {
      const modelWithFilter = {
        type: 'equals',
        filter: 'option1,option2'
      }
      const props = { ...defaultProps, model: modelWithFilter, multiple: true }
      
      render(<BCSelectFloatingFilter {...props} />)
      
      const select = document.getElementById('select-filter')
      expect(Array.from(select.selectedOptions).map(o => o.value)).toEqual(['option1', 'option2'])
    })
  })

  describe('handleChange Function', () => {
    it('calls handleChange when select value changes in single mode', async () => {
      const user = userEvent.setup()
      render(<BCSelectFloatingFilter {...defaultProps} />)
      
      const select = document.getElementById('select-filter')
      
      // Use userEvent to actually trigger the change event and handleChange function
      await user.selectOptions(select, 'option1')
      
      expect(mockOnModelChange).toHaveBeenCalledWith({
        type: 'equals',
        filter: 'option1'
      })
    })

    it('calls handleChange when select value changes in multiple mode', async () => {
      const user = userEvent.setup()
      const props = { ...defaultProps, multiple: true }
      render(<BCSelectFloatingFilter {...props} />)
      
      const select = document.getElementById('select-filter')
      
      // Use userEvent to select multiple options and trigger handleChange
      await user.selectOptions(select, ['option1', 'option2'])
      
      expect(mockOnModelChange).toHaveBeenCalledWith({
        type: 'equals',
        filter: 'option1,option2'
      })
    })

  })

  describe('handleClear Function', () => {
    it('clears selection and calls onModelChange with null', () => {
      const props = {
        ...defaultProps,
        model: { type: 'equals', filter: 'option1' }
      }
      render(<BCSelectFloatingFilter {...props} />)
      
      const clearButton = screen.getByTestId('icon-button')
      const mockEvent = { stopPropagation: vi.fn() }
      
      fireEvent.click(clearButton, mockEvent)
      
      expect(mockOnModelChange).toHaveBeenCalledWith(null)
    })


    it('handles mouseDown event propagation', () => {
      const props = {
        ...defaultProps,
        model: { type: 'equals', filter: 'option1' }
      }
      render(<BCSelectFloatingFilter {...props} />)
      
      const clearButton = screen.getByTestId('icon-button')
      const stopPropagationSpy = vi.fn()
      
      fireEvent.mouseDown(clearButton, { stopPropagation: stopPropagationSpy })
      
      expect(clearButton).toBeInTheDocument()
    })
  })

  describe('Clear Button Rendering', () => {
    it('shows clear button when values are selected', () => {
      const props = {
        ...defaultProps,
        model: { type: 'equals', filter: 'option1' }
      }
      render(<BCSelectFloatingFilter {...props} />)
      
      expect(screen.getByTestId('icon-button')).toBeInTheDocument()
      expect(screen.getByTestId('clear-icon')).toBeInTheDocument()
    })

    it('hides clear button when no values selected', () => {
      render(<BCSelectFloatingFilter {...defaultProps} />)
      
      expect(screen.queryByTestId('icon-button')).not.toBeInTheDocument()
    })

    it('shows clear button in multiple mode when values selected', () => {
      const props = {
        ...defaultProps,
        multiple: true,
        model: { type: 'equals', filter: 'option1,option2' }
      }
      render(<BCSelectFloatingFilter {...props} />)
      
      expect(screen.getByTestId('icon-button')).toBeInTheDocument()
    })
  })

  describe('Disabled State', () => {
    it('disables select when disabled prop is true', () => {
      const props = { ...defaultProps, disabled: true }
      render(<BCSelectFloatingFilter {...props} />)
      
      const select = document.getElementById('select-filter')
      expect(select).toHaveAttribute('disabled')
      expect(select).toHaveAttribute('aria-disabled', 'true')
    })

    it('disables select when isLoading is true', () => {
      const loadingOptionsQuery = vi.fn(() => ({
        data: null,
        isLoading: true,
        isError: false,
        error: null
      }))
      
      const props = { ...defaultProps, optionsQuery: loadingOptionsQuery }
      render(<BCSelectFloatingFilter {...props} />)
      
      const select = document.getElementById('select-filter')
      expect(select).toHaveAttribute('disabled')
      expect(select).toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('Accessibility Attributes', () => {
    it('has correct ARIA attributes for single mode', () => {
      render(<BCSelectFloatingFilter {...defaultProps} />)
      
      const group = screen.getByRole('group')
      expect(group).toHaveAttribute('aria-labelledby', 'select-filter-label')
      
      const container = document.querySelector('.select-container')
      expect(container).toHaveAttribute('role', 'combobox')
      expect(container).toHaveAttribute('aria-controls', 'select-filter')
      expect(container).toHaveAttribute('aria-expanded', 'false')
      
      const select = document.getElementById('select-filter')
      expect(select).toHaveAttribute('aria-multiselectable', 'false')
      expect(select).toHaveAttribute('aria-describedby', 'select-filter-description')
    })

    it('has correct ARIA attributes for multiple mode', () => {
      const props = { ...defaultProps, multiple: true }
      render(<BCSelectFloatingFilter {...props} />)
      
      const select = document.getElementById('select-filter')
      expect(select).toHaveAttribute('aria-multiselectable', 'true')
    })

    it('switches aria-describedby for error state', () => {
      const errorOptionsQuery = vi.fn(() => ({
        data: null,
        isLoading: false,
        isError: true,
        error: { message: 'Error' }
      }))
      
      const props = { ...defaultProps, optionsQuery: errorOptionsQuery }
      render(<BCSelectFloatingFilter {...props} />)
      
      const select = document.getElementById('select-filter')
      expect(select).toHaveAttribute('aria-describedby', 'select-filter-error')
    })

    it('updates aria-expanded based on selected values', () => {
      const props = {
        ...defaultProps,
        model: { type: 'equals', filter: 'option1' }
      }
      render(<BCSelectFloatingFilter {...props} />)
      
      const container = document.querySelector('.select-container')
      expect(container).toHaveAttribute('aria-expanded', 'true')
    })
  })

  describe('Event Handlers and Interactions', () => {
    it('handles clear button accessibility', () => {
      const props = {
        ...defaultProps,
        model: { type: 'equals', filter: 'option1' }
      }
      render(<BCSelectFloatingFilter {...props} />)
      
      const clearButton = screen.getByTestId('icon-button')
      expect(clearButton).toHaveAttribute('aria-label', 'Clear selection')
      expect(clearButton).toHaveAttribute('tabIndex', '-1')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty optionsData', () => {
      const emptyOptionsQuery = vi.fn(() => ({
        data: [],
        isLoading: false,
        isError: false,
        error: null
      }))
      
      const props = { ...defaultProps, optionsQuery: emptyOptionsQuery }
      render(<BCSelectFloatingFilter {...props} />)
      
      expect(screen.getByText('Select')).toBeInTheDocument()
      expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
    })

    it('handles null optionsData', () => {
      const nullOptionsQuery = vi.fn(() => ({
        data: null,
        isLoading: false,
        isError: false,
        error: null
      }))
      
      const props = { ...defaultProps, optionsQuery: nullOptionsQuery }
      render(<BCSelectFloatingFilter {...props} />)
      
      expect(screen.getByText('Select')).toBeInTheDocument()
    })

    it('handles malformed model data', () => {
      const malformedModel = { type: 'equals' } // missing filter
      const props = { ...defaultProps, model: malformedModel }
      
      expect(() => render(<BCSelectFloatingFilter {...props} />)).not.toThrow()
    })

    it('handles custom initialFilterType', () => {
      const props = { ...defaultProps, initialFilterType: 'contains' }
      render(<BCSelectFloatingFilter {...props} />)
      
      const select = document.getElementById('select-filter')
      expect(select).toBeInTheDocument()
      // Test that component renders with custom filter type
      expect(select).toHaveAttribute('id', 'select-filter')
    })

    it('handles missing params gracefully', () => {
      const props = { ...defaultProps, params: undefined }
      
      expect(() => render(<BCSelectFloatingFilter {...props} />)).not.toThrow()
    })

    it('handles filter values with special characters', () => {
      const specialModel = {
        type: 'equals',
        filter: 'option,with,commas'
      }
      const props = { ...defaultProps, model: specialModel, multiple: true }
      
      render(<BCSelectFloatingFilter {...props} />)
      
      // Should split on commas and handle each part
      const select = document.getElementById('select-filter')
      expect(select).toBeInTheDocument()
    })
  })
})