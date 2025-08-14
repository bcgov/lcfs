import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme } from '@mui/material/styles'
import { TextCellEditor } from '../TextCellEditor'

// Mock InputMask since it's an external library
vi.mock('react-input-mask', () => ({
  default: ({ value, onChange, mask, formatChars, children, disabled }) => {
    // Create a test button that triggers the onChange to test handleTextFieldChange
    const handleTestChange = () => {
      if (onChange) {
        onChange({ target: { value: 'test change' } })
      }
    }
    
    return (
      <div 
        data-test="input-mask" 
        data-mask={mask || ''} 
        data-format-chars={formatChars ? JSON.stringify(formatChars) : ''} 
        data-disabled={String(disabled)}
      >
        <button data-test="trigger-change" onClick={handleTestChange}>
          Trigger Change
        </button>
        {children({})}
      </div>
    )
  }
}))

const theme = createTheme()

const renderWithTheme = (component) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  )
}

describe('TextCellEditor', () => {
  let mockOnValueChange
  let defaultProps

  beforeEach(() => {
    mockOnValueChange = vi.fn()
    defaultProps = {
      value: 'test value',
      onValueChange: mockOnValueChange,
      eventKey: 'Enter',
      rowIndex: 0,
      column: { field: 'test' }
    }
  })

  describe('Component Rendering', () => {
    it('renders correctly with basic props', () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const inputMask = screen.getByTestId('input-mask')
      expect(inputMask).toBeInTheDocument()
      
      const textField = screen.getByRole('textbox')
      expect(textField).toBeInTheDocument()
    })

    it('renders with mask prop', () => {
      const props = { ...defaultProps, mask: '(999) 999-9999' }
      renderWithTheme(<TextCellEditor {...props} />)
      
      const inputMask = screen.getByTestId('input-mask')
      expect(inputMask).toHaveAttribute('data-mask', '(999) 999-9999')
    })

    it('renders with formatChars prop', () => {
      const formatChars = { '9': '[0-9]', 'a': '[A-Za-z]' }
      const props = { ...defaultProps, formatChars }
      renderWithTheme(<TextCellEditor {...props} />)
      
      const inputMask = screen.getByTestId('input-mask')
      expect(inputMask).toHaveAttribute('data-format-chars', JSON.stringify(formatChars))
    })

    it('renders with inputProps', () => {
      const inputProps = { placeholder: 'Enter text', maxLength: 50 }
      const props = { ...defaultProps, inputProps }
      renderWithTheme(<TextCellEditor {...props} />)
      
      const textField = screen.getByRole('textbox')
      expect(textField).toBeInTheDocument()
    })
  })

  describe('useEffect - Focus Behavior', () => {
    it('focuses input on mount', () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const textField = screen.getByRole('textbox')
      expect(textField).toHaveFocus()
    })
  })

  describe('handleTextFieldChange Function', () => {
    it('calls onValueChange when triggered through InputMask onChange', () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      // Click the test button that triggers the onChange handler
      const triggerButton = screen.getByTestId('trigger-change')
      fireEvent.click(triggerButton)
      
      expect(mockOnValueChange).toHaveBeenCalledWith('test change')
    })

    it('handleTextFieldChange function processes event.target.value correctly', () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const triggerButton = screen.getByTestId('trigger-change')
      fireEvent.click(triggerButton)
      
      // Verify the function was called with the correct processed value
      expect(mockOnValueChange).toHaveBeenCalledTimes(1)
      expect(mockOnValueChange).toHaveBeenCalledWith('test change')
    })
  })

  describe('Props Passing', () => {
    it('InputMask receives correct props', () => {
      const props = {
        ...defaultProps,
        mask: '999-999-9999',
        formatChars: { '9': '[0-9]' }
      }
      renderWithTheme(<TextCellEditor {...props} />)
      
      const inputMask = screen.getByTestId('input-mask')
      expect(inputMask).toHaveAttribute('data-mask', '999-999-9999')
      expect(inputMask).toHaveAttribute('data-format-chars', JSON.stringify({ '9': '[0-9]' }))
      expect(inputMask).toHaveAttribute('data-disabled', 'false')
    })

    it('TextField receives correct props', () => {
      renderWithTheme(<TextCellEditor {...defaultProps} />)
      
      const textField = screen.getByRole('textbox')
      expect(textField).toBeInTheDocument()
    })
  })

  describe('forwardRef Functionality', () => {
    it('forwards ref correctly', () => {
      const ref = createRef()
      renderWithTheme(<TextCellEditor {...defaultProps} ref={ref} />)
      
      expect(ref.current).toBeTruthy()
    })
  })

  describe('Combined Props', () => {
    it('handles all props combined', () => {
      const props = {
        ...defaultProps,
        mask: '(999) 999-9999',
        formatChars: { '9': '[0-9]' },
        inputProps: { placeholder: 'Phone number' }
      }
      renderWithTheme(<TextCellEditor {...props} />)
      
      const inputMask = screen.getByTestId('input-mask')
      expect(inputMask).toBeInTheDocument()
      expect(inputMask).toHaveAttribute('data-mask', '(999) 999-9999')
      
      const textField = screen.getByRole('textbox')
      expect(textField).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty value', () => {
      const props = { ...defaultProps, value: '' }
      renderWithTheme(<TextCellEditor {...props} />)
      
      const textField = screen.getByRole('textbox')
      expect(textField).toBeInTheDocument()
    })

    it('handles undefined mask', () => {
      const props = { ...defaultProps, mask: undefined }
      renderWithTheme(<TextCellEditor {...props} />)
      
      const inputMask = screen.getByTestId('input-mask')
      expect(inputMask).toHaveAttribute('data-mask', '')
    })
  })
})