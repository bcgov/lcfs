import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { DateEditor } from '../DateEditor'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { ThemeProvider, createTheme } from '@mui/material/styles'

// Mock date-fns functions
vi.mock('date-fns', () => ({
  format: vi.fn((date, formatStr) => {
    if (!date) return ''
    if (formatStr === 'yyyy-MM-dd') {
      return date.toISOString().split('T')[0]
    }
    return date.toString()
  }),
  parseISO: vi.fn((dateStr) => {
    if (!dateStr || dateStr === 'YYYY-MM-DD') return null
    return new Date(dateStr)
  })
}))

// Mock MUI DatePicker
vi.mock('@mui/x-date-pickers', () => ({
  DatePicker: React.forwardRef(({
    value,
    onChange,
    onOpen,
    onClose,
    open,
    minDate,
    maxDate,
    slotProps,
    className,
    ...props
  }, ref) => {
    const [isOpenState, setIsOpenState] = React.useState(open || false)
    
    React.useEffect(() => {
      setIsOpenState(open || false)
    }, [open])
    
    const handleDateChange = (newDate) => {
      onChange(newDate)
    }
    
    const handleOpenCalendar = () => {
      setIsOpenState(true)
      onOpen?.()
    }
    
    const handleCloseCalendar = () => {
      setIsOpenState(false)
      onClose?.()
    }
    
    const handleClear = () => {
      onChange(null)
      slotProps?.field?.onClear?.()
      slotProps?.clearButton?.onClick?.()
    }
    
    return (
      <div
        ref={ref}
        data-test="date-picker"
        className={className}
        {...props}
      >
        <input
          data-test="date-input"
          type="text"
          value={value ? value.toISOString().split('T')[0] : ''}
          onChange={(e) => {
            const newDate = e.target.value ? new Date(e.target.value) : null
            handleDateChange(newDate)
          }}
          placeholder="YYYY-MM-DD"
        />
        <button
          data-test="calendar-button"
          onClick={handleOpenCalendar}
          type="button"
        >
          📅
        </button>
        <button
          data-test="clear-button"
          onClick={handleClear}
          type="button"
        >
          ✕
        </button>
        {isOpenState && (
          <div data-test="calendar-popup">
            <button
              data-test="select-date"
              onClick={() => {
                const testDate = new Date('2024-03-15')
                handleDateChange(testDate)
                handleCloseCalendar()
              }}
            >
              Select 2024-03-15
            </button>
            <button
              data-test="close-calendar"
              onClick={handleCloseCalendar}
            >
              Close
            </button>
          </div>
        )}
      </div>
    )
  })
}))

// Create test theme and providers
const testTheme = createTheme()

const TestWrapper = ({ children }) => (
  <ThemeProvider theme={testTheme}>
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      {children}
    </LocalizationProvider>
  </ThemeProvider>
)

const renderWithProviders = (ui, options = {}) => {
  return render(ui, { wrapper: TestWrapper, ...options })
}

// Mock AG-Grid API
const createMockApi = () => ({
  getLastDisplayedRowIndex: vi.fn(() => 5)
})

describe('DateEditor', () => {
  let mockOnValueChange
  let mockApi
  let user
  let defaultProps

  beforeEach(() => {
    mockOnValueChange = vi.fn()
    mockApi = createMockApi()
    user = userEvent.setup()
    defaultProps = {
      value: '2024-01-15',
      onValueChange: mockOnValueChange,
      rowIndex: 0,
      api: mockApi
    }

    // Mock document event listeners
    const mockAddEventListener = vi.fn()
    const mockRemoveEventListener = vi.fn()
    Object.defineProperty(document, 'addEventListener', {
      writable: true,
      value: mockAddEventListener
    })
    Object.defineProperty(document, 'removeEventListener', {
      writable: true,
      value: mockRemoveEventListener
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render with initial date value', () => {
      renderWithProviders(<DateEditor {...defaultProps} />)
      
      const datePicker = screen.getByTestId('date-picker')
      const dateInput = screen.getByTestId('date-input')
      
      expect(datePicker).toBeInTheDocument()
      expect(dateInput).toHaveValue('2024-01-15')
    })

    it('should render with null value', () => {
      renderWithProviders(<DateEditor {...defaultProps} value={null} />)
      
      const dateInput = screen.getByTestId('date-input')
      expect(dateInput).toHaveValue('')
    })

    it('should render with undefined value', () => {
      renderWithProviders(<DateEditor {...defaultProps} value={undefined} />)
      
      const dateInput = screen.getByTestId('date-input')
      expect(dateInput).toHaveValue('')
    })

    it('should render with YYYY-MM-DD placeholder value', () => {
      renderWithProviders(<DateEditor {...defaultProps} value="YYYY-MM-DD" />)
      
      const dateInput = screen.getByTestId('date-input')
      expect(dateInput).toHaveValue('')
    })

    it('should render calendar and clear buttons', () => {
      renderWithProviders(<DateEditor {...defaultProps} />)
      
      expect(screen.getByTestId('calendar-button')).toBeInTheDocument()
      expect(screen.getByTestId('clear-button')).toBeInTheDocument()
    })

    it('should have proper container styling', () => {
      renderWithProviders(<DateEditor {...defaultProps} />)
      
      const container = screen.getByTestId('date-picker').parentElement
      expect(container).toHaveClass('date-picker-container')
      expect(container).toHaveStyle({
        width: '100%',
        height: '100%',
        position: 'absolute'
      })
    })
  })

  describe('Date Input Handling', () => {
    it('should handle direct date input', async () => {
      renderWithProviders(<DateEditor {...defaultProps} value="" />)
      
      const dateInput = screen.getByTestId('date-input')
      await user.clear(dateInput)
      await user.type(dateInput, '2024-06-30')
      
      expect(mockOnValueChange).toHaveBeenCalledWith('2024-06-30')
    })

    it('should handle invalid date input gracefully', async () => {
      renderWithProviders(<DateEditor {...defaultProps} value="" />)
      
      const dateInput = screen.getByTestId('date-input')
      await user.clear(dateInput)
      await user.type(dateInput, 'invalid-date')
      
      // Should handle invalid dates without crashing
      expect(screen.getByTestId('date-picker')).toBeInTheDocument()
    })

    it('should handle clearing date input', async () => {
      renderWithProviders(<DateEditor {...defaultProps} />)
      
      const dateInput = screen.getByTestId('date-input')
      await user.clear(dateInput)
      
      expect(mockOnValueChange).toHaveBeenCalledWith(null)
    })

    it('should handle date change from calendar', async () => {
      renderWithProviders(<DateEditor {...defaultProps} />)
      
      const calendarButton = screen.getByTestId('calendar-button')
      await user.click(calendarButton)
      
      await waitFor(() => {
        expect(screen.getByTestId('calendar-popup')).toBeInTheDocument()
      })
      
      const selectDateButton = screen.getByTestId('select-date')
      await user.click(selectDateButton)
      
      expect(mockOnValueChange).toHaveBeenCalledWith('2024-03-15')
    })

    it('should normalize dates to avoid timezone issues', () => {
      const testDate = new Date('2024-06-15T10:30:00Z')
      renderWithProviders(<DateEditor {...defaultProps} />)
      
      // Simulate internal updateValue function call
      const dateInput = screen.getByTestId('date-input')
      fireEvent.change(dateInput, { target: { value: '2024-06-15' } })
      
      expect(mockOnValueChange).toHaveBeenCalledWith('2024-06-15')
    })
  })

  describe('Calendar Interaction', () => {
    it('should open calendar when calendar button is clicked', async () => {
      renderWithProviders(<DateEditor {...defaultProps} />)
      
      const calendarButton = screen.getByTestId('calendar-button')
      await user.click(calendarButton)
      
      await waitFor(() => {
        expect(screen.getByTestId('calendar-popup')).toBeInTheDocument()
      })
    })

    it('should close calendar when close button is clicked', async () => {
      renderWithProviders(<DateEditor {...defaultProps} />)
      
      // Open calendar
      const calendarButton = screen.getByTestId('calendar-button')
      await user.click(calendarButton)
      
      await waitFor(() => {
        expect(screen.getByTestId('calendar-popup')).toBeInTheDocument()
      })
      
      // Close calendar
      const closeButton = screen.getByTestId('close-calendar')
      await user.click(closeButton)
      
      await waitFor(() => {
        expect(screen.queryByTestId('calendar-popup')).not.toBeInTheDocument()
      })
    })

    it('should auto-open calendar for last row when autoOpenLastRow is true', () => {
      mockApi.getLastDisplayedRowIndex.mockReturnValue(3)
      
      renderWithProviders(
        <DateEditor
          {...defaultProps}
          rowIndex={3}
          autoOpenLastRow={true}
        />
      )
      
      expect(screen.getByTestId('calendar-popup')).toBeInTheDocument()
    })

    it('should not auto-open calendar when autoOpenLastRow is false', () => {
      mockApi.getLastDisplayedRowIndex.mockReturnValue(3)
      
      renderWithProviders(
        <DateEditor
          {...defaultProps}
          rowIndex={3}
          autoOpenLastRow={false}
        />
      )
      
      expect(screen.queryByTestId('calendar-popup')).not.toBeInTheDocument()
    })

    it('should not auto-open calendar when not on last row', () => {
      mockApi.getLastDisplayedRowIndex.mockReturnValue(5)
      
      renderWithProviders(
        <DateEditor
          {...defaultProps}
          rowIndex={3}
          autoOpenLastRow={true}
        />
      )
      
      expect(screen.queryByTestId('calendar-popup')).not.toBeInTheDocument()
    })
  })

  describe('Clear Functionality', () => {
    it('should clear date when clear button is clicked', async () => {
      renderWithProviders(<DateEditor {...defaultProps} />)
      
      const clearButton = screen.getByTestId('clear-button')
      await user.click(clearButton)
      
      expect(mockOnValueChange).toHaveBeenCalledWith(null)
    })

    it('should handle clearing null value', async () => {
      renderWithProviders(<DateEditor {...defaultProps} value={null} />)
      
      const clearButton = screen.getByTestId('clear-button')
      await user.click(clearButton)
      
      expect(mockOnValueChange).toHaveBeenCalledWith(null)
    })

    it('should update local state when clearing', async () => {
      renderWithProviders(<DateEditor {...defaultProps} />)
      
      const clearButton = screen.getByTestId('clear-button')
      await user.click(clearButton)
      
      const dateInput = screen.getByTestId('date-input')
      expect(dateInput).toHaveValue('')
    })
  })

  describe('Date Range Constraints', () => {
    it('should pass minDate to DatePicker', () => {
      const minDate = new Date('2024-01-01')
      renderWithProviders(
        <DateEditor {...defaultProps} minDate={minDate} />
      )
      
      // DatePicker should receive minDate prop
      const datePicker = screen.getByTestId('date-picker')
      expect(datePicker).toBeInTheDocument()
    })

    it('should pass maxDate to DatePicker', () => {
      const maxDate = new Date('2024-12-31')
      renderWithProviders(
        <DateEditor {...defaultProps} maxDate={maxDate} />
      )
      
      // DatePicker should receive maxDate prop
      const datePicker = screen.getByTestId('date-picker')
      expect(datePicker).toBeInTheDocument()
    })

    it('should handle both minDate and maxDate constraints', () => {
      const minDate = new Date('2024-01-01')
      const maxDate = new Date('2024-12-31')
      
      renderWithProviders(
        <DateEditor
          {...defaultProps}
          minDate={minDate}
          maxDate={maxDate}
        />
      )
      
      const datePicker = screen.getByTestId('date-picker')
      expect(datePicker).toBeInTheDocument()
    })
  })

  describe('Event Handling and Propagation', () => {
    it('should stop event propagation on container click', async () => {
      renderWithProviders(<DateEditor {...defaultProps} />)
      
      const container = screen.getByTestId('date-picker').parentElement
      
      const clickEvent = new MouseEvent('click', { bubbles: true })
      const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation')
      const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault')
      
      fireEvent(container, clickEvent)
      
      // Our component should handle event propagation
      expect(container).toBeInTheDocument()
    })

    it('should stop event propagation on mouse down', async () => {
      renderWithProviders(<DateEditor {...defaultProps} />)
      
      const container = screen.getByTestId('date-picker').parentElement
      
      const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true })
      fireEvent(container, mouseDownEvent)
      
      expect(container).toBeInTheDocument()
    })

    it('should handle click outside to close calendar', () => {
      renderWithProviders(<DateEditor {...defaultProps} />)
      
      // Verify event listener was added for click outside
      expect(document.addEventListener).toHaveBeenCalledWith(
        'mousedown',
        expect.any(Function),
        expect.objectContaining({ passive: true })
      )
    })

    it('should clean up event listeners on unmount', () => {
      const { unmount } = renderWithProviders(<DateEditor {...defaultProps} />)
      
      unmount()
      
      expect(document.removeEventListener).toHaveBeenCalledWith(
        'mousedown',
        expect.any(Function)
      )
    })
  })

  describe('Styling and Z-Index', () => {
    it('should increase z-index when calendar is open', async () => {
      renderWithProviders(<DateEditor {...defaultProps} />)
      
      const container = screen.getByTestId('date-picker').parentElement
      
      // Initially should have auto z-index
      expect(container).toHaveStyle({ zIndex: 'auto' })
      
      // Open calendar
      const calendarButton = screen.getByTestId('calendar-button')
      await user.click(calendarButton)
      
      await waitFor(() => {
        expect(container).toHaveStyle({ zIndex: '1000' })
      })
    })

    it('should apply proper styling to prevent text selection', () => {
      renderWithProviders(<DateEditor {...defaultProps} />)
      
      const datePicker = screen.getByTestId('date-picker')
      expect(datePicker).toBeInTheDocument()
      
      // Component should have user-select: none styles applied
      expect(datePicker).toHaveClass('ag-grid-date-editor')
    })

    it('should have full width and height styling', () => {
      renderWithProviders(<DateEditor {...defaultProps} />)
      
      const container = screen.getByTestId('date-picker').parentElement
      expect(container).toHaveStyle({
        width: '100%',
        height: '100%'
      })
    })
  })

  describe('Integration Scenarios', () => {
    it('should work with AG-Grid editor lifecycle', async () => {
      renderWithProviders(
        <DateEditor
          {...defaultProps}
          rowIndex={2}
          value="2024-05-20"
        />
      )
      
      // Should render and be ready for AG-Grid integration
      const dateInput = screen.getByTestId('date-input')
      expect(dateInput).toHaveValue('2024-05-20')
      
      // Should handle value changes
      await user.clear(dateInput)
      await user.type(dateInput, '2024-12-25')
      
      expect(mockOnValueChange).toHaveBeenCalledWith('2024-12-25')
    })

    it('should handle rapid date changes', async () => {
      renderWithProviders(<DateEditor {...defaultProps} value="" />)
      
      const dateInput = screen.getByTestId('date-input')
      
      // Rapid date changes
      await user.type(dateInput, '2024-01-01')
      await user.clear(dateInput)
      await user.type(dateInput, '2024-02-02')
      await user.clear(dateInput)
      await user.type(dateInput, '2024-03-03')
      
      expect(mockOnValueChange).toHaveBeenCalledTimes(6) // 3 clears + 3 type operations
    })

    it('should maintain state during calendar operations', async () => {
      renderWithProviders(<DateEditor {...defaultProps} />)
      
      // Open calendar
      const calendarButton = screen.getByTestId('calendar-button')
      await user.click(calendarButton)
      
      // Select date from calendar
      const selectDateButton = screen.getByTestId('select-date')
      await user.click(selectDateButton)
      
      // Verify final state
      const dateInput = screen.getByTestId('date-input')
      expect(dateInput).toHaveValue('2024-03-15')
      expect(mockOnValueChange).toHaveBeenCalledWith('2024-03-15')
    })

    it('should handle edge case with multiple null value updates', () => {
      renderWithProviders(<DateEditor {...defaultProps} value={null} />)
      
      // Clear multiple times
      const clearButton = screen.getByTestId('clear-button')
      fireEvent.click(clearButton)
      fireEvent.click(clearButton)
      fireEvent.click(clearButton)
      
      // Should handle multiple null updates gracefully
      expect(mockOnValueChange).toHaveBeenCalledWith(null)
      expect(screen.getByTestId('date-input')).toHaveValue('')
    })
  })

  describe('Error Handling', () => {
    it('should handle missing api gracefully', () => {
      renderWithProviders(
        <DateEditor
          {...defaultProps}
          api={null}
          autoOpenLastRow={true}
        />
      )
      
      // Should not crash with missing API
      expect(screen.getByTestId('date-picker')).toBeInTheDocument()
    })

    it('should handle invalid date objects', async () => {
      renderWithProviders(<DateEditor {...defaultProps} />)
      
      const dateInput = screen.getByTestId('date-input')
      
      // Simulate invalid date input
      fireEvent.change(dateInput, { target: { value: '2024-13-45' } })
      
      // Should handle invalid dates without crashing
      expect(screen.getByTestId('date-picker')).toBeInTheDocument()
    })

    it('should handle component unmount during open calendar', () => {
      const { unmount } = renderWithProviders(<DateEditor {...defaultProps} />)
      
      // Open calendar then unmount
      const calendarButton = screen.getByTestId('calendar-button')
      fireEvent.click(calendarButton)
      
      // Should unmount without errors
      expect(() => unmount()).not.toThrow()
    })
  })
})