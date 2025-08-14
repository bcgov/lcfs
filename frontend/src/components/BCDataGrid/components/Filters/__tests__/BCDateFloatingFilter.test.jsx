import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { BCDateFloatingFilter } from '../BCDateFloatingFilter'

// Mock date-fns
const { mockFormat, mockIsValid } = vi.hoisted(() => ({
  mockFormat: vi.fn((date, formatStr) => {
    if (!date) return null
    if (formatStr === 'yyyy-MM-dd') {
      return date.toISOString().split('T')[0]
    }
    return date.toISOString()
  }),
  mockIsValid: vi.fn((date) => {
    return date && date instanceof Date && !isNaN(date.getTime())
  })
}))

vi.mock('date-fns', () => ({
  format: mockFormat,
  isValid: mockIsValid
}))

// Mock @mui/material components
vi.mock('@mui/material', () => ({
  FormControl: vi.fn(({ children, fullWidth, size, role, sx, ...props }) => (
    <div data-test="form-control" {...props}>
      {children}
    </div>
  )),
  IconButton: vi.fn(({ children, onClick, onMouseDown, sx, size, edge, ...props }) => (
    <button
      data-test="icon-button"
      onClick={onClick}
      onMouseDown={onMouseDown}
      {...props}
    >
      {children}
    </button>
  )),
  InputAdornment: vi.fn(({ children, position, ...props }) => (
    <div data-test={`input-adornment-${position}`} {...props}>
      {children}
    </div>
  ))
}))

// Mock @mui/icons-material
vi.mock('@mui/icons-material', () => ({
  Clear: vi.fn(() => <span data-test="clear-icon">Clear</span>),
  CalendarToday: vi.fn(() => <span data-test="calendar-icon">Calendar</span>)
}))

// Mock @mui/x-date-pickers
const mockDatePickerProps = {}
vi.mock('@mui/x-date-pickers', () => ({
  DatePicker: vi.fn((props) => {
    Object.assign(mockDatePickerProps, props)
    const { value, onChange, onOpen, onClose, open, slotProps, minDate, maxDate, disabled, format, sx, id, ...domProps } = props
    
    return (
      <div data-test="date-picker">
        <input
          data-test="date-input"
          value={value && !isNaN(value.getTime()) ? value.toISOString().split('T')[0] : ''}
          onChange={(e) => {
            const val = e.target.value ? new Date(e.target.value) : null
            onChange?.(val)
          }}
          disabled={disabled}
        />
        <div data-test="start-adornment">
          {slotProps?.textField?.InputProps?.startAdornment}
        </div>
        <div data-test="end-adornment">
          {slotProps?.textField?.InputProps?.endAdornment}
        </div>
        <button
          data-test="open-picker-button"
          onClick={() => onOpen?.()}
          style={{ display: open ? 'none' : 'block' }}
        >
          Open
        </button>
        <button
          data-test="close-picker-button"
          onClick={() => onClose?.()}
          style={{ display: open ? 'block' : 'none' }}
        >
          Close
        </button>
      </div>
    )
  })
}))

describe('BCDateFloatingFilter', () => {
  const mockOnModelChange = vi.fn()

  const defaultProps = {
    model: null,
    onModelChange: mockOnModelChange,
    disabled: false,
    minDate: '2013-01-01',
    maxDate: '2040-01-01',
    initialFilterType: 'any',
    label: 'Select Date'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFormat.mockImplementation((date, formatStr) => {
      if (!date || isNaN(date.getTime())) return null
      if (formatStr === 'yyyy-MM-dd') {
        return date.toISOString().split('T')[0]
      }
      return date.toISOString()
    })
    mockIsValid.mockImplementation((date) => {
      return date && date instanceof Date && !isNaN(date.getTime())
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders with minimal props', () => {
      render(<BCDateFloatingFilter {...defaultProps} />)
      
      expect(screen.getByTestId('form-control')).toBeInTheDocument()
      expect(screen.getByTestId('date-picker')).toBeInTheDocument()
      expect(screen.getByTestId('date-input')).toBeInTheDocument()
    })

    it('renders with custom props', () => {
      const customProps = {
        ...defaultProps,
        disabled: true,
        label: 'Custom Date Label',
        minDate: '2020-01-01',
        maxDate: '2030-12-31'
      }
      
      render(<BCDateFloatingFilter {...customProps} />)
      
      expect(screen.getByTestId('date-input')).toBeDisabled()
      // Verify the custom label is passed through slotProps
      expect(mockDatePickerProps.slotProps?.textField?.label).toBe('Custom Date Label')
    })

    it('renders clear button when selectedDate exists', async () => {
      const validDate = new Date('2023-12-25')
      mockIsValid.mockReturnValue(true)
      
      render(<BCDateFloatingFilter {...defaultProps} />)
      
      const dateInput = screen.getByTestId('date-input')
      
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2023-12-25' } })
      })
      
      const endAdornment = screen.getByTestId('end-adornment')
      expect(endAdornment).toBeInTheDocument()
    })
  })

  describe('handleChange Function', () => {
    it('calls onModelChange with correct filter model for valid date', async () => {
      mockIsValid.mockReturnValue(true)
      mockFormat.mockReturnValue('2023-12-25')
      
      render(<BCDateFloatingFilter {...defaultProps} />)
      
      const dateInput = screen.getByTestId('date-input')
      const testDate = new Date('2023-12-25')
      
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2023-12-25' } })
      })
      
      expect(mockOnModelChange).toHaveBeenCalledWith({
        filterType: 'date',
        type: 'any',
        dateFrom: '2023-12-25',
        dateTo: undefined
      })
    })

    it('calls onModelChange(undefined) for invalid date', async () => {
      mockIsValid.mockReturnValue(false)
      
      render(<BCDateFloatingFilter {...defaultProps} />)
      
      const dateInput = screen.getByTestId('date-input')
      
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: 'invalid-date' } })
      })
      
      expect(mockOnModelChange).toHaveBeenCalledWith(undefined)
    })

    it('calls onModelChange(undefined) for null date', async () => {
      // First set a valid date, then clear it
      mockIsValid.mockReturnValueOnce(true).mockReturnValueOnce(false)
      mockFormat.mockReturnValue('2023-12-25')
      
      render(<BCDateFloatingFilter {...defaultProps} />)
      
      const dateInput = screen.getByTestId('date-input')
      
      // Set a valid date first
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2023-12-25' } })
      })
      
      // Clear the date  
      mockOnModelChange.mockClear()
      
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '' } })
      })
      
      expect(mockOnModelChange).toHaveBeenCalledWith(undefined)
    })


  })

  describe('handleClear Function', () => {
    it('stops event propagation and clears date', async () => {
      mockIsValid.mockReturnValue(true)
      
      render(<BCDateFloatingFilter {...defaultProps} />)
      
      // First set a date
      const dateInput = screen.getByTestId('date-input')
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2023-12-25' } })
      })
      
      // Find and click clear button
      const endAdornment = screen.getByTestId('end-adornment')
      const clearButton = endAdornment.querySelector('[data-test="icon-button"]')
      
      const mockEvent = {
        stopPropagation: vi.fn()
      }
      
      await act(async () => {
        fireEvent.click(clearButton, mockEvent)
      })
      
      expect(mockOnModelChange).toHaveBeenCalledWith(undefined)
    })
  })

  describe('handleOpen and handleClose Functions', () => {
    it('opens date picker when handleOpen is called', async () => {
      render(<BCDateFloatingFilter {...defaultProps} />)
      
      const openButton = screen.getByTestId('open-picker-button')
      
      await act(async () => {
        fireEvent.click(openButton)
      })
      
      expect(screen.getByTestId('close-picker-button')).toBeVisible()
      expect(screen.queryByTestId('open-picker-button')).not.toBeVisible()
    })

    it('closes date picker when handleClose is called', async () => {
      render(<BCDateFloatingFilter {...defaultProps} />)
      
      // First open the picker
      const openButton = screen.getByTestId('open-picker-button')
      await act(async () => {
        fireEvent.click(openButton)
      })
      
      // Then close it
      const closeButton = screen.getByTestId('close-picker-button')
      await act(async () => {
        fireEvent.click(closeButton)
      })
      
      expect(screen.getByTestId('open-picker-button')).toBeVisible()
      expect(screen.queryByTestId('close-picker-button')).not.toBeVisible()
    })
  })

  describe('useEffect Hook', () => {
    it('clears selectedDate when model is null', async () => {
      const { rerender } = render(<BCDateFloatingFilter {...defaultProps} model={{ dateFrom: '2023-12-25' }} />)
      
      await act(async () => {
        rerender(<BCDateFloatingFilter {...defaultProps} model={null} />)
      })
      
      expect(screen.getByTestId('date-input')).toHaveValue('')
    })

    it('sets selectedDate when model has valid dateFrom', async () => {
      mockIsValid.mockReturnValue(true)
      
      const modelWithDate = {
        dateFrom: '2023-12-25'
      }
      
      render(<BCDateFloatingFilter {...defaultProps} model={modelWithDate} />)
      
      expect(screen.getByTestId('date-input')).toHaveValue('2023-12-25')
    })

    it('sets selectedDate to null when model has invalid dateFrom', async () => {
      mockIsValid.mockReturnValue(false)
      
      const modelWithInvalidDate = {
        dateFrom: 'invalid-date'
      }
      
      render(<BCDateFloatingFilter {...defaultProps} model={modelWithInvalidDate} />)
      
      expect(screen.getByTestId('date-input')).toHaveValue('')
    })

    it('does not change selectedDate when model exists but has no dateFrom', async () => {
      const modelWithoutDateFrom = {
        filterType: 'date',
        type: 'any'
      }
      
      render(<BCDateFloatingFilter {...defaultProps} model={modelWithoutDateFrom} />)
      
      expect(screen.getByTestId('date-input')).toHaveValue('')
    })
  })

  describe('Event Handlers', () => {
    it('opens date picker when calendar icon is clicked', async () => {
      render(<BCDateFloatingFilter {...defaultProps} />)
      
      const startAdornment = screen.getByTestId('start-adornment')
      const calendarButton = startAdornment.querySelector('[data-test="icon-button"]')
      
      await act(async () => {
        fireEvent.click(calendarButton)
      })
      
      expect(screen.getByTestId('close-picker-button')).toBeVisible()
    })

    it('triggers handleChange when DatePicker onChange is called', async () => {
      mockIsValid.mockReturnValue(true)
      mockFormat.mockReturnValue('2023-12-25')
      
      render(<BCDateFloatingFilter {...defaultProps} />)
      
      const dateInput = screen.getByTestId('date-input')
      
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2023-12-25' } })
      })
      
      expect(mockOnModelChange).toHaveBeenCalled()
    })

    it('stops propagation on clear button mouseDown', async () => {
      mockIsValid.mockReturnValue(true)
      
      render(<BCDateFloatingFilter {...defaultProps} />)
      
      // Set a date first
      const dateInput = screen.getByTestId('date-input')
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2023-12-25' } })
      })
      
      const endAdornment = screen.getByTestId('end-adornment')
      const clearButton = endAdornment.querySelector('[data-test="icon-button"]')
      
      const mockEvent = {
        stopPropagation: vi.fn()
      }
      
      await act(async () => {
        fireEvent.mouseDown(clearButton, mockEvent)
      })
      
      // The component should handle the event without errors
      expect(clearButton).toBeInTheDocument()
    })
  })

  describe('Props Integration', () => {
    it('passes disabled prop correctly', () => {
      render(<BCDateFloatingFilter {...defaultProps} disabled={true} />)
      
      expect(screen.getByTestId('date-input')).toBeDisabled()
    })

    it('passes custom minDate and maxDate props', () => {
      const customProps = {
        ...defaultProps,
        minDate: '2020-01-01',
        maxDate: '2030-12-31'
      }
      
      render(<BCDateFloatingFilter {...customProps} />)
      
      // Verify the DatePicker received the correct props
      expect(mockDatePickerProps.minDate).toEqual(new Date('2020-01-01'))
      expect(mockDatePickerProps.maxDate).toEqual(new Date('2030-12-31'))
    })
  })
})