import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { NumberEditor } from '../NumberEditor'
import { ThemeProvider, createTheme } from '@mui/material/styles'

// Create test theme
const testTheme = createTheme()

// Test wrapper with theme
const TestWrapper = ({ children }) => (
  <ThemeProvider theme={testTheme}>
    {children}
  </ThemeProvider>
)

const renderWithTheme = (ui, options = {}) => {
  return render(ui, { wrapper: TestWrapper, ...options })
}

describe('NumberEditor', () => {
  let mockOnValueChange
  let user
  let defaultProps

  beforeEach(() => {
    mockOnValueChange = vi.fn()
    user = userEvent.setup()
    defaultProps = {
      value: 1000,
      onValueChange: mockOnValueChange,
      eventKey: null,
      rowIndex: 0,
      column: { field: 'value' }
    }
  })

  describe('Component Rendering', () => {
    it('should render with initial value', () => {
      renderWithTheme(<NumberEditor {...defaultProps} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveValue('1,000') // Formatted with comma
    })

    it('should render with zero value', () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={0} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('0')
    })

    it('should render with undefined value as 0', () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={undefined} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('0')
    })

    it('should render with null value as 0', () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={null} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('0')
    })

    it('should render with NaN value as 0', () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={NaN} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('0')
    })

    it('should focus input on mount', async () => {
      renderWithTheme(<NumberEditor {...defaultProps} />)
      
      const input = screen.getByRole('textbox')
      await waitFor(() => {
        expect(input).toHaveFocus()
      })
    })
  })

  describe('Number Formatting', () => {
    it('should format large numbers with thousands separators', () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={1234567} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('1,234,567')
    })

    it('should format decimal numbers correctly', () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={1234.56} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('1,234.56')
    })

    it('should handle single digit numbers', () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={5} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('5')
    })

    it('should handle negative numbers', () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={-1000} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('-1,000')
    })
  })

  describe('User Input Handling', () => {
    it('should handle numeric input correctly', async () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={0} />)
      
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, '5000')
      
      expect(mockOnValueChange).toHaveBeenCalledWith(5000)
    })

    it('should remove commas from input before processing', async () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={1000} />)
      
      const input = screen.getByRole('textbox')
      // Clear and type a value with commas
      await user.clear(input)
      await user.type(input, '10,000')
      
      expect(mockOnValueChange).toHaveBeenCalledWith(10000)
    })

    it('should handle decimal input', async () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={0} />)
      
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, '123.45')
      
      expect(mockOnValueChange).toHaveBeenCalledWith(123)
    })

    it('should reject non-numeric input', async () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={1000} />)
      
      const input = screen.getByRole('textbox')
      const initialCallCount = mockOnValueChange.mock.calls.length
      
      await user.clear(input)
      await user.type(input, 'abc')
      
      // Should not call onValueChange for invalid input
      expect(mockOnValueChange.mock.calls.length).toBe(initialCallCount)
    })

    it('should handle empty input', async () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={1000} />)
      
      const input = screen.getByRole('textbox')
      await user.clear(input)
      
      expect(mockOnValueChange).toHaveBeenCalledWith(0)
    })

    it('should handle mixed valid and invalid characters', async () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={0} />)
      
      const input = screen.getByRole('textbox')
      await user.clear(input)
      
      // Type valid number first
      await user.type(input, '123')
      expect(mockOnValueChange).toHaveBeenCalledWith(123)
      
      // Try to add invalid characters - should be rejected
      const callCountBefore = mockOnValueChange.mock.calls.length
      fireEvent.change(input, { target: { value: '123abc' } })
      
      // Should not trigger additional calls for invalid input
      expect(mockOnValueChange.mock.calls.length).toBe(callCountBefore)
    })
  })

  describe('Min/Max Constraints', () => {
    it('should enforce minimum value constraint', async () => {
      renderWithTheme(
        <NumberEditor {...defaultProps} value={10} min={5} max={100} />
      )
      
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, '2') // Below minimum
      
      expect(mockOnValueChange).toHaveBeenCalledWith(5) // Should be clamped to min
    })

    it('should enforce maximum value constraint', async () => {
      renderWithTheme(
        <NumberEditor {...defaultProps} value={10} min={5} max={100} />
      )
      
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, '150') // Above maximum
      
      expect(mockOnValueChange).toHaveBeenCalledWith(100) // Should be clamped to max
    })

    it('should allow values within range', async () => {
      renderWithTheme(
        <NumberEditor {...defaultProps} value={10} min={5} max={100} />
      )
      
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, '50') // Within range
      
      expect(mockOnValueChange).toHaveBeenCalledWith(50)
    })

    it('should handle no min/max constraints', async () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={0} />)
      
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, '999999')
      
      expect(mockOnValueChange).toHaveBeenCalledWith(999999)
    })
  })

  describe('Imperative Handle Methods', () => {
    it('should expose getValue method that removes commas', () => {
      const ref = React.createRef()
      renderWithTheme(<NumberEditor ref={ref} {...defaultProps} value={12345} />)
      
      // The getValue method should return the raw number as string without commas
      expect(ref.current.getValue()).toBe('12345')
    })

    it('should expose isCancelBeforeStart method', () => {
      const ref = React.createRef()
      renderWithTheme(<NumberEditor ref={ref} {...defaultProps} />)
      
      expect(ref.current.isCancelBeforeStart()).toBe(false)
    })

    it('should expose isCancelAfterEnd method', () => {
      const ref = React.createRef()
      renderWithTheme(<NumberEditor ref={ref} {...defaultProps} />)
      
      expect(ref.current.isCancelAfterEnd()).toBe(false)
    })

    it('should handle getValue with formatted display value', () => {
      const ref = React.createRef()
      renderWithTheme(<NumberEditor ref={ref} {...defaultProps} value={1000000} />)
      
      // Even though display shows '1,000,000', getValue should return '1000000'
      expect(ref.current.getValue()).toBe('1000000')
    })
  })

  describe('Styling and Props', () => {
    it('should apply input props correctly', () => {
      renderWithTheme(
        <NumberEditor {...defaultProps} min={10} max={100} />
      )
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('min', '10')
      expect(input).toHaveAttribute('max', '100')
    })

    it('should have numeric input mode', () => {
      renderWithTheme(<NumberEditor {...defaultProps} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('inputMode', 'numeric')
    })

    it('should be full width', () => {
      renderWithTheme(<NumberEditor {...defaultProps} />)
      
      const textField = screen.getByRole('textbox').closest('.MuiTextField-root')
      expect(textField).toHaveClass('MuiTextField-fullWidth')
    })

    it('should use small size', () => {
      renderWithTheme(<NumberEditor {...defaultProps} />)
      
      const textField = screen.getByRole('textbox').closest('.MuiTextField-root')
      expect(textField).toHaveClass('MuiTextField-sizeSmall')
    })

    it('should use outlined variant', () => {
      renderWithTheme(<NumberEditor {...defaultProps} />)
      
      const input = screen.getByRole('textbox')
      expect(input.closest('.MuiOutlinedInput-root')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle very large numbers', async () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={0} />)
      
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, '999999999')
      
      expect(mockOnValueChange).toHaveBeenCalledWith(999999999)
    })

    it('should handle zero input explicitly', async () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={100} />)
      
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, '0')
      
      expect(mockOnValueChange).toHaveBeenCalledWith(0)
    })

    it('should handle rapid input changes', async () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={0} />)
      
      const input = screen.getByRole('textbox')
      
      // Rapid successive inputs
      await user.clear(input)
      await user.type(input, '1')
      await user.type(input, '2')
      await user.type(input, '3')
      
      // Should handle all changes
      expect(mockOnValueChange).toHaveBeenCalled()
    })

    it('should handle leading zeros', async () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={0} />)
      
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, '0000123')
      
      expect(mockOnValueChange).toHaveBeenCalledWith(123)
    })

    it('should handle negative sign correctly', async () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={0} />)
      
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, '-500')
      
      expect(mockOnValueChange).toHaveBeenCalledWith(-500)
    })
  })

  describe('Integration Scenarios', () => {
    it('should work with AG-Grid editor lifecycle', () => {
      const ref = React.createRef()
      renderWithTheme(
        <NumberEditor
          ref={ref}
          {...defaultProps}
          value={1000}
          eventKey="Enter"
          rowIndex={2}
        />
      )
      
      // Should be ready for AG-Grid integration
      expect(ref.current.getValue()).toBe('1000')
      expect(ref.current.isCancelBeforeStart()).toBe(false)
      expect(ref.current.isCancelAfterEnd()).toBe(false)
    })

    it('should handle focus and blur events properly', async () => {
      renderWithTheme(<NumberEditor {...defaultProps} />)
      
      const input = screen.getByRole('textbox')
      
      // Should auto-focus on mount
      await waitFor(() => {
        expect(input).toHaveFocus()
      })
      
      // Should handle blur
      fireEvent.blur(input)
      expect(input).not.toHaveFocus()
      
      // Should handle focus again
      fireEvent.focus(input)
      expect(input).toHaveFocus()
    })

    it('should maintain formatting during edit session', async () => {
      renderWithTheme(<NumberEditor {...defaultProps} value={1234} />)
      
      const input = screen.getByRole('textbox')
      
      // Initial formatted value
      expect(input).toHaveValue('1,234')
      
      // Add more digits
      await user.clear(input)
      await user.type(input, '12345')
      
      // Should format the new value
      expect(input).toHaveValue('12,345')
    })
  })
})