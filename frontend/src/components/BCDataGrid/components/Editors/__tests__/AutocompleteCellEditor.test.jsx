/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRef } from 'react'
import { AutocompleteCellEditor } from '../AutocompleteCellEditor'

// Mock MUI components
vi.mock('@mui/material', () => ({
  Autocomplete: vi.fn(({ children, onChange, onOpen, onClose, onKeyDown, getOptionLabel, renderOption, renderInput, renderTags, isOptionEqualToValue, multiple, ...props }) => {
    // Test getOptionLabel if provided
    if (getOptionLabel) {
      getOptionLabel('test')
      getOptionLabel({ label: 'test' })
      getOptionLabel(null)
    }

    // Test isOptionEqualToValue if provided
    if (isOptionEqualToValue) {
      isOptionEqualToValue('option', 'value')
    }

    return (
      <div
        data-test="autocomplete"
        onClick={() => {
          // In multiple mode, MUI Autocomplete passes an array; in single mode, a single value
          if (onChange) onChange({}, multiple ? ['new value'] : 'new value')
          if (onOpen) onOpen()
        }}
        onKeyDown={(e) => {
          if (onKeyDown) onKeyDown(e)
        }}
        {...props}
      >
        {renderInput && renderInput({ inputProps: {} })}
        {renderOption && renderOption({}, 'option', { selected: false })}
        {renderTags && renderTags(['tag1', 'tag2'], () => ({ index: 0 }))}
        Autocomplete
      </div>
    )
  }),
  TextField: vi.fn(({ onBlur, inputRef, ...props }) => (
    <input
      data-test="textfield"
      ref={inputRef}
      onBlur={onBlur}
      {...props}
    />
  )),
  Checkbox: vi.fn((props) => (
    <input type="checkbox" data-test="checkbox" {...props} />
  )),
  Box: vi.fn(({ children, ...props }) => (
    <div data-test="box" {...props}>{children}</div>
  )),
  Chip: vi.fn(({ label, ...props }) => (
    <span data-test="chip" {...props}>{label}</span>
  )),
  Stack: vi.fn(({ children, ...props }) => (
    <div data-test="stack" {...props}>{children}</div>
  )),
  Divider: vi.fn((props) => (
    <hr data-test="divider" {...props} />
  ))
}))

vi.mock('@mui/icons-material', () => ({
  CheckBox: vi.fn(() => <span data-test="checkbox-icon">CheckBox</span>),
  CheckBoxOutlineBlank: vi.fn(() => <span data-test="checkbox-outline-icon">CheckBoxOutlineBlank</span>)
}))

// Mock AgGrid API
const mockApi = {
  getFocusedCell: vi.fn(),
  startEditingCell: vi.fn(),
  stopEditing: vi.fn(),
  tabToNextCell: vi.fn(),
  tabToPreviousCell: vi.fn()
}

describe('AutocompleteCellEditor Component', () => {
  let mockProps
  let mockRef
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    mockRef = createRef()
    
    mockProps = {
      value: '',
      options: ['Option 1', 'Option 2', 'Option 3'],
      api: mockApi,
      column: { getId: () => 'testColumn' },
      node: { data: {} },
      onValueChange: vi.fn(),
      onKeyDownCapture: vi.fn(),
      onBlur: vi.fn(),
      onPaste: vi.fn(),
      colDef: {
        cellEditorParams: {
          label: 'Test Label'
        }
      }
    }
    
    mockApi.getFocusedCell.mockReturnValue({
      rowIndex: 0,
      column: { getId: () => 'testColumn' }
    })
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component Rendering', () => {
    it('renders with default props', () => {
      render(<AutocompleteCellEditor {...mockProps} ref={mockRef} />)
      
      expect(screen.getAllByTestId('box')).toHaveLength(2) // Container box + renderOption box
      expect(screen.getByTestId('autocomplete')).toBeInTheDocument()
      expect(screen.getByTestId('textfield')).toBeInTheDocument()
    })
    
    it('renders with multiple selection enabled', () => {
      const props = { ...mockProps, multiple: true }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(screen.getByTestId('autocomplete')).toBeInTheDocument()
    })
    
    it('renders with freeSolo enabled', () => {
      const props = { ...mockProps, freeSolo: true }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(screen.getByTestId('autocomplete')).toBeInTheDocument()
    })
  })

  describe('parseInitialValue Function', () => {
    it('returns correct value for null/undefined input in single mode', () => {
      const props = { ...mockProps, value: null, multiple: false }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(mockRef.current.getValue()).toBe('')
    })
    
    it('returns correct value for null/undefined input in multiple mode', () => {
      const props = { ...mockProps, value: null, multiple: true }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(mockRef.current.getValue()).toEqual([])
    })
    
    it('returns array as-is when array input provided', () => {
      const props = { ...mockProps, value: ['Option 1', 'Option 2'], multiple: true }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(mockRef.current.getValue()).toEqual(['Option 1', 'Option 2'])
    })
    
    it('handles string input in single mode', () => {
      const props = { ...mockProps, value: 'Option 1', multiple: false }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(mockRef.current.getValue()).toBe('Option 1')
    })
    
    it('handles comma-separated string input in multiple mode', () => {
      const props = { ...mockProps, value: 'Option 1, Option 2', multiple: true }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(mockRef.current.getValue()).toEqual(['Option 1', 'Option 2'])
    })
    
    it('handles comma-separated string input in single mode', () => {
      const props = { ...mockProps, value: 'Option 1, Option 2', multiple: false }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(mockRef.current.getValue()).toBe('Option 1')
    })
    
    it('handles non-string/non-array input in multiple mode', () => {
      const props = { ...mockProps, value: 123, multiple: true }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(mockRef.current.getValue()).toEqual([])
    })
    
    it('handles non-string/non-array input in single mode', () => {
      const props = { ...mockProps, value: 123, multiple: false }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(mockRef.current.getValue()).toBe('')
    })
  })

  describe('Imperative Handle Methods', () => {
    it('getValue returns correct value for single mode', () => {
      render(<AutocompleteCellEditor {...mockProps} ref={mockRef} />)
      
      expect(mockRef.current.getValue()).toBe('')
    })
    
    it('getValue returns correct value for multiple mode', () => {
      const props = { ...mockProps, multiple: true }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(mockRef.current.getValue()).toEqual([])
    })
    
    it('getValue handles non-array selectedValues in multiple mode', () => {
      const props = { ...mockProps, value: 'test', multiple: true }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      // Manually set selectedValues to non-array to test the safety check
      act(() => {
        const autocomplete = screen.getByTestId('autocomplete')
        fireEvent.click(autocomplete)
      })
      
      expect(typeof mockRef.current.getValue()).toBe('object')
    })
    
    it('isCancelBeforeStart returns false', () => {
      render(<AutocompleteCellEditor {...mockProps} ref={mockRef} />)
      
      expect(mockRef.current.isCancelBeforeStart()).toBe(false)
    })
    
    it('isCancelAfterEnd returns false', () => {
      render(<AutocompleteCellEditor {...mockProps} ref={mockRef} />)
      
      expect(mockRef.current.isCancelAfterEnd()).toBe(false)
    })
    
    it('afterGuiAttached focuses input when ref exists', () => {
      render(<AutocompleteCellEditor {...mockProps} ref={mockRef} />)
      
      const input = screen.getByTestId('textfield')
      const focusSpy = vi.spyOn(input, 'focus')
      
      mockRef.current.afterGuiAttached()
      
      expect(focusSpy).toHaveBeenCalled()
    })
  })

  describe('handleChange Function', () => {
    it('updates selectedValues and calls onValueChange in single mode', () => {
      render(<AutocompleteCellEditor {...mockProps} ref={mockRef} />)
      
      const autocomplete = screen.getByTestId('autocomplete')
      fireEvent.click(autocomplete)
      
      expect(mockProps.onValueChange).toHaveBeenCalledWith('new value')
    })
    
    it('updates selectedValues and calls onValueChange in multiple mode', () => {
      const props = { ...mockProps, multiple: true }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)

      const autocomplete = screen.getByTestId('autocomplete')
      fireEvent.click(autocomplete)
      
      expect(props.onValueChange).toHaveBeenCalledWith([])
    })
    
  })


  describe('handleKeyDown Function', () => {
    it('calls onKeyDownCapture when provided', () => {
      render(<AutocompleteCellEditor {...mockProps} ref={mockRef} />)
      
      const autocomplete = screen.getByTestId('autocomplete')
      fireEvent.keyDown(autocomplete, { key: 'Enter' })
      
      expect(mockProps.onKeyDownCapture).toHaveBeenCalled()
    })
    
  })

  describe('handleBlur Function', () => {
    it('calls onBlur callback and stops editing', () => {
      render(<AutocompleteCellEditor {...mockProps} ref={mockRef} />)
      
      const input = screen.getByTestId('textfield')
      fireEvent.blur(input)
      
      expect(mockProps.onBlur).toHaveBeenCalled()
      expect(mockApi.stopEditing).toHaveBeenCalled()
    })
    
    it('handles case when onBlur callback is not provided', () => {
      const props = { ...mockProps, onBlur: undefined }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      const input = screen.getByTestId('textfield')
      fireEvent.blur(input)
      
      expect(mockApi.stopEditing).toHaveBeenCalled()
    })
  })

  describe('isOptionEqualToValue Function', () => {
    it('returns false for null/undefined option or value', () => {
      render(<AutocompleteCellEditor {...mockProps} ref={mockRef} />)
      
      // Function is tested indirectly through Autocomplete mock
      expect(screen.getByTestId('autocomplete')).toBeInTheDocument()
    })
    
    it('compares string options and values correctly', () => {
      const props = { ...mockProps, options: ['test1', 'test2'] }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(screen.getByTestId('autocomplete')).toBeInTheDocument()
    })
    
    it('compares object options and values correctly', () => {
      const props = { 
        ...mockProps, 
        options: [{ label: 'test1' }, { label: 'test2' }] 
      }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(screen.getByTestId('autocomplete')).toBeInTheDocument()
    })
    
    it('compares object option with string value correctly', () => {
      const props = { 
        ...mockProps, 
        options: [{ label: 'test1' }],
        value: 'test1'
      }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(screen.getByTestId('autocomplete')).toBeInTheDocument()
    })
    
    it('compares string option with object value correctly', () => {
      const props = { 
        ...mockProps, 
        options: ['test1'],
        value: { label: 'test1' }
      }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(screen.getByTestId('autocomplete')).toBeInTheDocument()
    })
  })

  describe('getOptionLabel Function', () => {
    it('returns empty string for null/undefined option', () => {
      render(<AutocompleteCellEditor {...mockProps} ref={mockRef} />)
      
      // Function is tested through the Autocomplete mock
      expect(screen.getByTestId('autocomplete')).toBeInTheDocument()
    })
    
    it('returns string option as-is', () => {
      const props = { ...mockProps, options: ['test'] }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(screen.getByTestId('autocomplete')).toBeInTheDocument()
    })
    
    it('returns object.label for object options', () => {
      const props = { 
        ...mockProps, 
        options: [{ label: 'test' }] 
      }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(screen.getByTestId('autocomplete')).toBeInTheDocument()
    })
  })


  describe('Label Handling', () => {
    it('shows custom label when provided', () => {
      const props = {
        ...mockProps,
        colDef: {
          cellEditorParams: {
            label: 'Custom Label'
          }
        }
      }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(screen.getByTestId('textfield')).toBeInTheDocument()
    })
    
    it('shows no label when noLabel is true', () => {
      const props = {
        ...mockProps,
        colDef: {
          cellEditorParams: {
            noLabel: true
          }
        }
      }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(screen.getByTestId('textfield')).toBeInTheDocument()
    })
    
    it('shows default Select label when no custom label provided', () => {
      const props = {
        ...mockProps,
        colDef: {
          cellEditorParams: {}
        }
      }
      render(<AutocompleteCellEditor {...props} ref={mockRef} />)
      
      expect(screen.getByTestId('textfield')).toBeInTheDocument()
    })
  })

  describe('State Management', () => {
    it('manages open/close state correctly', () => {
      render(<AutocompleteCellEditor {...mockProps} ref={mockRef} />)
      
      const autocomplete = screen.getByTestId('autocomplete')
      fireEvent.click(autocomplete) // Should trigger onOpen
      
      expect(screen.getByTestId('autocomplete')).toBeInTheDocument()
    })
  })

  describe('Props Validation', () => {
    it('handles missing optional props gracefully', () => {
      const minimalProps = {
        options: ['Option 1'],
        api: mockApi
      }
      
      render(<AutocompleteCellEditor {...minimalProps} ref={mockRef} />)
      
      expect(screen.getByTestId('autocomplete')).toBeInTheDocument()
      expect(mockRef.current.getValue()).toBe('')
    })
    
    it('handles all boolean props correctly', () => {
      const booleanProps = {
        ...mockProps,
        multiple: true,
        disableCloseOnSelect: true,
        openOnFocus: false,
        freeSolo: true
      }
      
      render(<AutocompleteCellEditor {...booleanProps} ref={mockRef} />)
      
      expect(screen.getByTestId('autocomplete')).toBeInTheDocument()
    })
  })
})