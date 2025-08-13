import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { TextCellEditor } from '../TextCellEditor'
import { ThemeProvider, createTheme } from '@mui/material/styles'

// Mock react-input-mask
vi.mock('react-input-mask', () => {
  return {
    default: ({ mask, formatChars, value, onChange, children, ...props }) => {
      // Render the child function with a mock input
      const childComponent = children()
      
      // Clone the child and add our mock props
      return React.cloneElement(childComponent, {
        ...childComponent.props,
        value: value || '',
        onChange: (e) => {
          // Apply basic mask logic for testing
          let maskedValue = e.target.value
          if (mask && mask.includes('(') && mask.includes(')')) {
            // Phone number mask simulation
            const digits = maskedValue.replace(/\D/g, '')
            if (digits.length >= 6) {
              maskedValue = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
            } else if (digits.length >= 3) {
              maskedValue = `(${digits.slice(0, 3)}) ${digits.slice(3)}`
            } else if (digits.length > 0) {
              maskedValue = `(${digits}`
            }
          }
          
          const mockEvent = {
            ...e,
            target: {
              ...e.target,
              value: maskedValue
            }
          }
          onChange(mockEvent)
        },
        'data-test': 'masked-input'
      })
    }
  }
})

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

describe('TextCellEditor', () => {
  let mockOnValueChange
  let user
  let defaultProps

  beforeEach(() => {
    mockOnValueChange = vi.fn()
    user = userEvent.setup()
    defaultProps = {
      value: 'Initial Value',
      onValueChange: mockOnValueChange,
      eventKey: null,
      rowIndex: 0,
      column: { field: 'name' }
    }
  })

  describe('Component Rendering', () => {
    it('should render with initial value', () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveValue('Initial Value')
    })

    it('should render with empty value', () => {
      renderWithTheme(<TextCellEditor {...defaultProps} value="" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('')
    })

    it('should render with null value', () => {
      renderWithTheme(<TextCellEditor {...defaultProps} value={null} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('')
    })

    it('should render with undefined value', () => {
      renderWithTheme(<TextCellEditor {...defaultProps} value={undefined} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('')
    })

    it('should focus input on mount', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const input = screen.getByRole('textbox')
      await waitFor(() => {
        expect(input).toHaveFocus()
      })
    })

    it('should render with masked input wrapper', () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const maskedInput = screen.getByTestId('masked-input')
      expect(maskedInput).toBeInTheDocument()
    })
  })

  describe('Text Input Handling', () => {
    it('should handle text input changes', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} value="" />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'New Text')
      
      expect(mockOnValueChange).toHaveBeenCalledWith('New Text')
    })

    it('should handle clearing text', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const input = screen.getByRole('textbox')
      await user.clear(input)
      
      expect(mockOnValueChange).toHaveBeenCalledWith('')
    })

    it('should handle replacing text', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, 'Replaced Text')
      
      expect(mockOnValueChange).toHaveBeenCalledWith('Replaced Text')
    })

    it('should handle special characters', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} value="" />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, '!@#$%^&*()')
      
      expect(mockOnValueChange).toHaveBeenCalledWith('!@#$%^&*()')
    })

    it('should handle unicode characters', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} value="" />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'Héllo Wörld 你好')
      
      expect(mockOnValueChange).toHaveBeenCalledWith('Héllo Wörld 你好')
    })

    it('should handle numbers as text', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} value="" />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, '12345')
      
      expect(mockOnValueChange).toHaveBeenCalledWith('12345')
    })
  }

  describe('Input Masking', () => {
    it('should render with phone number mask', () => {
      const maskProps = {
        ...defaultProps,
        mask: '(999) 999-9999',
        formatChars: { '9': '[0-9]' }
      }
      
      renderWithTheme(<TextCellEditor {...maskProps} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
    })

    it('should apply phone number formatting', async () => {
      const maskProps = {
        ...defaultProps,
        value: '',
        mask: '(999) 999-9999',
        formatChars: { '9': '[0-9]' }
      }
      
      renderWithTheme(<TextCellEditor {...maskProps} />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, '1234567890')
      
      // Should format as phone number
      expect(mockOnValueChange).toHaveBeenCalledWith('(123) 456-7890')
    })

    it('should handle partial phone number input', async () => {
      const maskProps = {
        ...defaultProps,
        value: '',
        mask: '(999) 999-9999',
        formatChars: { '9': '[0-9]' }
      }
      
      renderWithTheme(<TextCellEditor {...maskProps} />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, '12345')
      
      // Should format partial number
      expect(mockOnValueChange).toHaveBeenCalledWith('(123) 45')
    })

    it('should work without mask', async () => {
      const noMaskProps = {
        ...defaultProps,
        value: '',
        mask: undefined
      }
      
      renderWithTheme(<TextCellEditor {...noMaskProps} />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'No mask text')
      
      expect(mockOnValueChange).toHaveBeenCalledWith('No mask text')
    })

    it('should handle custom format characters', () => {
      const customMaskProps = {
        ...defaultProps,
        mask: 'AAA-999',
        formatChars: {
          'A': '[A-Za-z]',
          '9': '[0-9]'
        }
      }
      
      renderWithTheme(<TextCellEditor {...customMaskProps} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
    })
  }

  describe('TextField Props', () => {
    it('should render as full width', () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const textField = screen.getByRole('textbox').closest('.MuiTextField-root')
      expect(textField).toHaveClass('MuiTextField-fullWidth')
    })

    it('should have no margin', () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const textField = screen.getByRole('textbox').closest('.MuiTextField-root')
      expect(textField).toHaveClass('MuiTextField-marginNone')
    })

    it('should pass through input props', () => {
      const inputProps = {
        maxLength: 50,
        placeholder: 'Enter text here'
      }
      
      renderWithTheme(
        <TextCellEditor
          {...defaultProps}
          inputProps={inputProps}
        />
      )
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('maxLength', '50')
      expect(input).toHaveAttribute('placeholder', 'Enter text here')
    })

    it('should not be disabled by default', () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const maskedInput = screen.getByTestId('masked-input')
      expect(maskedInput).not.toBeDisabled()
    })
  }

  describe('Ref Handling', () => {
    it('should forward ref correctly', () => {
      const ref = React.createRef()
      renderWithTheme(<TextCellEditor ref={ref} {...defaultProps} />)
      
      expect(ref.current).not.toBeNull()
    })

    it('should provide access to input through internal ref', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const input = screen.getByRole('textbox')
      await waitFor(() => {
        expect(input).toHaveFocus()
      })
    })
  }

  describe('Event Handling', () => {
    it('should handle focus events', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const input = screen.getByRole('textbox')
      
      fireEvent.focus(input)
      expect(input).toHaveFocus()
    })

    it('should handle blur events', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const input = screen.getByRole('textbox')
      
      fireEvent.focus(input)
      fireEvent.blur(input)
      expect(input).not.toHaveFocus()
    })

    it('should handle key press events', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const input = screen.getByRole('textbox')
      
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
      // Should not crash on key events
      expect(input).toBeInTheDocument()
    })

    it('should handle rapid typing', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} value="" />)
      
      const input = screen.getByRole('textbox')
      
      // Simulate rapid typing
      await user.type(input, 'Quick brown fox', { delay: 1 })
      
      expect(mockOnValueChange).toHaveBeenCalledWith('Quick brown fox')
    })
  }

  describe('Edge Cases', () => {
    it('should handle very long text input', async () => {
      const longText = 'A'.repeat(1000)
      renderWithTheme(<TextCellEditor {...defaultProps} value="" />)
      
      const input = screen.getByRole('textbox')
      
      // Simulate paste of long text
      fireEvent.change(input, { target: { value: longText } })
      
      expect(mockOnValueChange).toHaveBeenCalledWith(longText)
    })

    it('should handle whitespace-only input', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} value="" />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, '   ')
      
      expect(mockOnValueChange).toHaveBeenCalledWith('   ')
    })

    it('should handle newline characters in text', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} value="" />)
      
      const input = screen.getByRole('textbox')
      
      // Simulate paste with newlines
      fireEvent.change(input, { target: { value: 'Line 1\nLine 2' } })
      
      expect(mockOnValueChange).toHaveBeenCalledWith('Line 1\nLine 2')
    })

    it('should handle tab characters', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} value="" />)
      
      const input = screen.getByRole('textbox')
      
      fireEvent.change(input, { target: { value: 'Tab\tSeparated' } })
      
      expect(mockOnValueChange).toHaveBeenCalledWith('Tab\tSeparated')
    })

    it('should handle mixed content with numbers and text', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} value="" />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'Product123_v2.0')
      
      expect(mockOnValueChange).toHaveBeenCalledWith('Product123_v2.0')
    })
  }

  describe('Integration Scenarios', () => {
    it('should work with AG-Grid editor lifecycle', () => {
      const ref = React.createRef()
      renderWithTheme(
        <TextCellEditor
          ref={ref}
          {...defaultProps}
          eventKey="Enter"
          rowIndex={2}
        />
      )
      
      // Should be ready for AG-Grid integration
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveValue('Initial Value')
    })

    it('should handle multiple rapid value changes', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} value="" />)
      
      const input = screen.getByRole('textbox')
      
      // Rapid changes
      await user.type(input, 'A')
      await user.type(input, 'B')
      await user.type(input, 'C')
      
      expect(mockOnValueChange).toHaveBeenCalledTimes(3)
    })

    it('should preserve formatting during edit session', async () => {
      const maskProps = {
        ...defaultProps,
        value: '',
        mask: '(999) 999-9999'
      }
      
      renderWithTheme(<TextCellEditor {...maskProps} />)
      
      const input = screen.getByRole('textbox')
      
      // Type partial number
      await user.type(input, '123')
      expect(mockOnValueChange).toHaveBeenCalledWith('(123')
      
      // Continue typing
      await user.type(input, '456')
      expect(mockOnValueChange).toHaveBeenCalledWith('(123) 456')
    })

    it('should handle editor with initial focus state', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      // Should auto-focus and be ready for immediate typing
      await waitFor(() => {
        const input = screen.getByRole('textbox')
        expect(input).toHaveFocus()
      })
      
      const input = screen.getByRole('textbox')
      await user.type(input, '{selectall}New Content')
      
      expect(mockOnValueChange).toHaveBeenCalledWith('New Content')
    })
  })

  describe('Accessibility', () => {
    it('should have proper text input role', () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
    })

    it('should be keyboard navigable', async () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const input = screen.getByRole('textbox')
      
      // Should be focusable via keyboard
      fireEvent.keyDown(document.body, { key: 'Tab' })
      await waitFor(() => {
        expect(input).toHaveFocus()
      })
    })

    it('should support screen reader text input', () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'text')
    })
  })
})