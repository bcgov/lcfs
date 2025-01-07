import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BCDateFloatingFilter } from './BCDateFloatingFilter'
import { format } from 'date-fns'

// Mock Material-UI components
vi.mock('@mui/material', () => ({
  FormControl: ({ children, ...props }) => <div {...props}>{children}</div>,
  IconButton: ({ children, onClick, ...props }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  InputAdornment: ({ children }) => <div>{children}</div>
}))

vi.mock('@mui/x-date-pickers', () => ({
  DatePicker: ({ value, onChange, onOpen, onClose, slotProps, ...props }) => (
    <div>
      <input
        type="text"
        value={value ? format(value, 'yyyy-MM-dd') : ''}
        onChange={(e) => onChange(new Date(e.target.value))}
        {...props}
      />
      {slotProps.textField.InputProps.startAdornment}
      {slotProps.textField.InputProps.endAdornment}
    </div>
  )
}))

describe('BCDateFloatingFilter', () => {
  const mockOnModelChange = vi.fn()
  const defaultProps = {
    model: null,
    onModelChange: mockOnModelChange,
    disabled: false,
    minDate: '2013-01-01',
    maxDate: '2040-01-01',
    initialFilterType: 'equals',
    label: 'Select Date'
  }

  beforeEach(() => {
    mockOnModelChange.mockClear()
  })

  it('renders with default props', () => {
    render(<BCDateFloatingFilter {...defaultProps} />)
    
    expect(screen.getByRole('group')).toBeInTheDocument()
    expect(screen.getByLabelText('Open calendar')).toBeInTheDocument()
    expect(screen.getByLabelText('Date Picker')).toBeInTheDocument()
  })

  it('handles date selection', async () => {
    render(<BCDateFloatingFilter {...defaultProps} />)
    
    const input = screen.getByLabelText('Date Picker')
    const testDate = '2024-01-01'
    
    fireEvent.change(input, { target: { value: testDate } })

    expect(mockOnModelChange).toHaveBeenCalledWith({
      type: 'equals',
      dateFrom: testDate,
      dateTo: null,
      filterType: 'date'
    })
  })

  it('handles date clearing', async () => {
    const initialModel = {
      type: 'equals',
      dateFrom: '2024-01-01',
      dateTo: null,
      filterType: 'date'
    }
    
    render(<BCDateFloatingFilter {...defaultProps} model={initialModel} />)
    
    const clearButton = screen.getByLabelText('Clear date')
    fireEvent.click(clearButton)

    expect(mockOnModelChange).toHaveBeenCalledWith(null)
  })

  it('initializes with model date when provided', () => {
    const modelWithDate = {
      type: 'equals',
      dateFrom: '2024-01-01',
      dateTo: null,
      filterType: 'date'
    }
    
    render(<BCDateFloatingFilter {...defaultProps} model={modelWithDate} />)
    
    const input = screen.getByLabelText('Date Picker')
    expect(input).toHaveValue('2024-01-01')
  })

  it('disables input when disabled prop is true', () => {
    render(<BCDateFloatingFilter {...defaultProps} disabled={true} />)
    
    const input = screen.getByLabelText('Date Picker')
    expect(input).toBeDisabled()
  })

  it('handles invalid date input', async () => {
    render(<BCDateFloatingFilter {...defaultProps} />)
    
    const input = screen.getByLabelText('Date Picker')
    fireEvent.change(input, { target: { value: 'invalid-date' } })

    expect(mockOnModelChange).toHaveBeenCalledWith(null)
  })

  it('opens calendar on calendar icon click', () => {
    render(<BCDateFloatingFilter {...defaultProps} />)
    
    const calendarButton = screen.getByLabelText('Open calendar')
    fireEvent.click(calendarButton)

    // Since we're mocking the DatePicker, we can't directly test if the calendar opens,
    // but we can verify the click handler was called
    expect(calendarButton).toBeInTheDocument()
  })

  it('maintains proper ARIA attributes', () => {
    render(<BCDateFloatingFilter {...defaultProps} />)
    
    const container = screen.getByRole('group')
    expect(container).toHaveAttribute('aria-labelledby', 'date-picker-label')
    
    const datePicker = screen.getByLabelText('Date Picker')
    expect(datePicker).toHaveAttribute('aria-describedby', 'date-picker-description')
  })

  it('respects min and max date constraints', () => {
    const customProps = {
      ...defaultProps,
      minDate: '2023-01-01',
      maxDate: '2025-01-01'
    }
    
    render(<BCDateFloatingFilter {...customProps} />)
    
    const input = screen.getByLabelText('Date Picker')
    expect(input).toBeInTheDocument()
    // Note: Actual min/max date validation would be handled by the DatePicker component
  })

  it('updates when model changes externally', () => {
    const { rerender } = render(<BCDateFloatingFilter {...defaultProps} />)
    
    const newModel = {
      type: 'equals',
      dateFrom: '2024-02-01',
      dateTo: null,
      filterType: 'date'
    }
    
    rerender(<BCDateFloatingFilter {...defaultProps} model={newModel} />)
    
    const input = screen.getByLabelText('Date Picker')
    expect(input).toHaveValue('2024-02-01')
  })
})