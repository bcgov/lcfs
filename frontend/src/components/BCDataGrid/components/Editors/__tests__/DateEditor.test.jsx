import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { DateEditor } from '../DateEditor'

// Mock date-fns
const { mockFormat, mockParseISO } = vi.hoisted(() => ({
  mockFormat: vi.fn((date, formatStr) => {
    if (!date) return null
    if (formatStr === 'yyyy-MM-dd') {
      return date.toISOString().split('T')[0]
    }
    return date.toISOString()
  }),
  mockParseISO: vi.fn((dateString) => {
    if (!dateString || dateString === 'YYYY-MM-DD') return null
    return new Date(dateString)
  })
}))

vi.mock('date-fns', () => ({
  format: mockFormat,
  parseISO: mockParseISO
}))

// Mock @mui/x-date-pickers
vi.mock('@mui/x-date-pickers', () => ({
  DatePicker: vi.fn(({ value, onChange, onOpen, onClose, open, slotProps, minDate, maxDate, ...restProps }) => {
    // Filter out MUI-specific props that shouldn't go on DOM elements
    const { fullWidth, margin, format, variant, disableToolbar, sx, className, id, ...domProps } = restProps
    
    return (
      <div data-test="date-picker">
        <input
          data-test="date-input"
          value={value ? value.toISOString().split('T')[0] : ''}
          onChange={(e) => {
            const val = e.target.value ? new Date(e.target.value) : null
            onChange?.(val)
          }}
          {...domProps}
        />
        <button
          data-test="open-picker-button" 
          onClick={() => {
            slotProps?.openPickerButton?.onClick?.()
            onOpen?.()
          }}
        >
          Open
        </button>
        <button
          data-test="clear-button"
          onClick={() => {
            slotProps?.clearButton?.onClick?.()
            onChange?.(null)
          }}
        >
          Clear
        </button>
        <button
          data-test="close-button"
          onClick={onClose}
          style={{ display: open ? 'block' : 'none' }}
        >
          Close
        </button>
      </div>
    )
  })
}))

describe('DateEditor', () => {
  const mockOnValueChange = vi.fn()
  const mockApi = {
    getLastDisplayedRowIndex: vi.fn(() => 5)
  }

  const defaultProps = {
    value: null,
    onValueChange: mockOnValueChange,
    rowIndex: 0,
    api: mockApi
  }

  beforeEach(() => {
    vi.clearAllMocks()
    document.addEventListener = vi.fn()
    document.removeEventListener = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders with minimal props', () => {
      render(<DateEditor {...defaultProps} />)
      
      expect(screen.getByTestId('date-picker')).toBeInTheDocument()
      expect(screen.getByTestId('date-input')).toBeInTheDocument()
    })
  })

  describe('Initial State - selectedDate', () => {
    it('initializes selectedDate with valid date value', () => {
      mockParseISO.mockReturnValue(new Date('2023-12-25'))
      
      render(<DateEditor {...defaultProps} value="2023-12-25" />)
      
      expect(mockParseISO).toHaveBeenCalledWith('2023-12-25')
      expect(screen.getByTestId('date-input')).toHaveValue('2023-12-25')
    })

    it('initializes selectedDate as null with invalid value', () => {
      render(<DateEditor {...defaultProps} value="YYYY-MM-DD" />)
      
      expect(screen.getByTestId('date-input')).toHaveValue('')
    })

    it('initializes selectedDate as null with empty value', () => {
      render(<DateEditor {...defaultProps} value="" />)
      
      expect(screen.getByTestId('date-input')).toHaveValue('')
    })

    it('initializes selectedDate as null with null value', () => {
      render(<DateEditor {...defaultProps} value={null} />)
      
      expect(screen.getByTestId('date-input')).toHaveValue('')
    })
  })

  describe('Initial State - isOpen', () => {
    it('initializes isOpen as false without autoOpenLastRow', () => {
      render(<DateEditor {...defaultProps} />)
      
      expect(screen.queryByTestId('close-button')).not.toBeVisible()
    })

    it('initializes isOpen as false when autoOpenLastRow is false', () => {
      render(<DateEditor {...defaultProps} autoOpenLastRow={false} />)
      
      expect(screen.queryByTestId('close-button')).not.toBeVisible()
    })

    it('initializes isOpen as true with autoOpenLastRow on last row', () => {
      mockApi.getLastDisplayedRowIndex.mockReturnValue(5)
      
      render(<DateEditor {...defaultProps} autoOpenLastRow={true} rowIndex={5} />)
      
      expect(mockApi.getLastDisplayedRowIndex).toHaveBeenCalled()
      expect(screen.getByTestId('close-button')).toBeVisible()
    })

    it('initializes isOpen as false with autoOpenLastRow not on last row', () => {
      mockApi.getLastDisplayedRowIndex.mockReturnValue(5)
      
      render(<DateEditor {...defaultProps} autoOpenLastRow={true} rowIndex={3} />)
      
      expect(mockApi.getLastDisplayedRowIndex).toHaveBeenCalled()
      expect(screen.queryByTestId('close-button')).not.toBeVisible()
    })
  })

  describe('useEffect Cleanup', () => {
    it('adds and removes event listener on mount/unmount', () => {
      const { unmount } = render(<DateEditor {...defaultProps} />)
      
      expect(document.addEventListener).toHaveBeenCalledWith(
        'mousedown',
        expect.any(Function),
        { passive: true }
      )
      
      unmount()
      
      expect(document.removeEventListener).toHaveBeenCalledWith(
        'mousedown',
        expect.any(Function)
      )
    })
  })

  describe('Click Outside Handler', () => {
    it('does not close when clicking inside container', () => {
      render(<DateEditor {...defaultProps} autoOpenLastRow={true} rowIndex={5} />)
      
      const container = screen.getByTestId('date-picker').parentElement
      const mockEvent = {
        target: container
      }
      
      container.contains = vi.fn(() => true)
      
      const addEventListenerCall = document.addEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )
      const handleClickOutside = addEventListenerCall[1]
      
      act(() => {
        handleClickOutside(mockEvent)
      })
      
      expect(screen.getByTestId('close-button')).toBeVisible()
    })

    it('closes when clicking outside container', () => {
      render(<DateEditor {...defaultProps} autoOpenLastRow={true} rowIndex={5} />)
      
      const container = screen.getByTestId('date-picker').parentElement
      const mockEvent = {
        target: document.body
      }
      
      container.contains = vi.fn(() => false)
      
      const addEventListenerCall = document.addEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )
      const handleClickOutside = addEventListenerCall[1]
      
      act(() => {
        handleClickOutside(mockEvent)
      })
      
      expect(screen.queryByTestId('close-button')).not.toBeVisible()
    })
  })

  describe('updateValue Function', () => {
    it('handles valid date correctly', () => {
      mockFormat.mockReturnValue('2023-12-25')
      
      render(<DateEditor {...defaultProps} />)
      
      const input = screen.getByTestId('date-input')
      
      act(() => {
        fireEvent.change(input, { target: { value: '2023-12-25' } })
      })
      
      expect(mockFormat).toHaveBeenCalledWith(expect.any(Date), 'yyyy-MM-dd')
      expect(mockOnValueChange).toHaveBeenCalledWith('2023-12-25')
    })
  })

  describe('DatePicker Event Handlers', () => {
    it('opens date picker when handleDatePickerOpen is called', () => {
      render(<DateEditor {...defaultProps} />)
      
      const openButton = screen.getByTestId('open-picker-button')
      
      act(() => {
        fireEvent.click(openButton)
      })
      
      expect(screen.getByTestId('close-button')).toBeVisible()
    })

    it('closes date picker when handleDatePickerClose is called', () => {
      render(<DateEditor {...defaultProps} autoOpenLastRow={true} rowIndex={5} />)
      
      expect(screen.getByTestId('close-button')).toBeVisible()
      
      const closeButton = screen.getByTestId('close-button')
      
      act(() => {
        fireEvent.click(closeButton)
      })
      
      expect(screen.queryByTestId('close-button')).not.toBeVisible()
    })
  })

  describe('stopPropagation Function', () => {
    it('handles null/undefined event gracefully', () => {
      render(<DateEditor {...defaultProps} />)
      
      const container = screen.getByTestId('date-picker').parentElement
      
      expect(() => {
        act(() => {
          fireEvent.mouseDown(container, null)
        })
      }).not.toThrow()
    })
  })

  describe('handleIconClick Function', () => {
    it('stops propagation and opens date picker', () => {
      render(<DateEditor {...defaultProps} />)
      
      const openButton = screen.getByTestId('open-picker-button')
      const mockEvent = {
        stopPropagation: vi.fn(),
        preventDefault: vi.fn()
      }
      
      act(() => {
        fireEvent.click(openButton, mockEvent)
      })
      
      expect(screen.getByTestId('close-button')).toBeVisible()
    })
  })

  describe('handleClear Function', () => {
    it('clears selectedDate and calls onValueChange with null', () => {
      render(<DateEditor {...defaultProps} value="2023-12-25" />)
      
      const clearButton = screen.getByTestId('clear-button')
      
      act(() => {
        fireEvent.click(clearButton)
      })
      
      expect(mockOnValueChange).toHaveBeenCalledWith(null)
      expect(screen.getByTestId('date-input')).toHaveValue('')
    })
  })

  describe('Props Integration', () => {
    it('passes minDate and maxDate props correctly', () => {
      const minDate = new Date('2023-01-01')
      const maxDate = new Date('2023-12-31')
      
      render(
        <DateEditor
          {...defaultProps}
          minDate={minDate}
          maxDate={maxDate}
        />
      )
      
      const datePicker = screen.getByTestId('date-picker')
      expect(datePicker).toBeInTheDocument()
    })

    it('renders with all prop combinations', () => {
      const props = {
        ...defaultProps,
        value: '2023-06-15',
        minDate: new Date('2023-01-01'),
        maxDate: new Date('2023-12-31'),
        autoOpenLastRow: true,
        rowIndex: 5
      }
      
      render(<DateEditor {...props} />)
      
      expect(screen.getByTestId('date-picker')).toBeInTheDocument()
      expect(screen.getByTestId('close-button')).toBeVisible()
    })
  })
})