import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme } from '@mui/material/styles'
import { NumberEditor } from '../NumberEditor'

const theme = createTheme()

const renderWithTheme = (component) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  )
}

describe('NumberEditor', () => {
  let mockOnValueChange
  let defaultProps

  beforeEach(() => {
    mockOnValueChange = vi.fn()
    defaultProps = {
      value: '1000',
      onValueChange: mockOnValueChange,
      eventKey: 'Enter',
      rowIndex: 0,
      column: { field: 'test' }
    }
  })

  describe('Component Rendering', () => {
    it('renders correctly', () => {
      renderWithTheme(<NumberEditor {...defaultProps} />)
      
      const input = screen.getByDisplayValue('1,000')
      expect(input).toBeInTheDocument()
    })

    it('renders with min and max props', () => {
      const props = { ...defaultProps, min: 0, max: 100 }
      renderWithTheme(<NumberEditor {...props} />)
      
      const input = screen.getByDisplayValue('1,000')
      expect(input).toHaveAttribute('min', '0')
      expect(input).toHaveAttribute('max', '100')
    })
  })

  describe('useEffect - Focus Behavior', () => {
    it('focuses input on mount', () => {
      renderWithTheme(<NumberEditor {...defaultProps} />)
      
      const input = screen.getByDisplayValue('1,000')
      expect(input).toHaveFocus()
    })
  })

  describe('formatNumber Function', () => {
    it('handles NaN input', () => {
      const props = { ...defaultProps, value: NaN }
      renderWithTheme(<NumberEditor {...props} />)
      
      const input = screen.getByDisplayValue('0')
      expect(input).toBeInTheDocument()
    })

    it('handles undefined input', () => {
      const props = { ...defaultProps, value: undefined }
      renderWithTheme(<NumberEditor {...props} />)
      
      const input = screen.getByDisplayValue('0')
      expect(input).toBeInTheDocument()
    })

    it('handles null input', () => {
      const props = { ...defaultProps, value: null }
      renderWithTheme(<NumberEditor {...props} />)
      
      const input = screen.getByDisplayValue('0')
      expect(input).toBeInTheDocument()
    })

    it('formats valid numbers with commas', () => {
      const props = { ...defaultProps, value: '1234567' }
      renderWithTheme(<NumberEditor {...props} />)
      
      const input = screen.getByDisplayValue('1,234,567')
      expect(input).toBeInTheDocument()
    })
  })

  describe('onInputChange Function', () => {
    it('handles empty string input', async () => {
      const user = userEvent.setup()
      renderWithTheme(<NumberEditor {...defaultProps} />)
      
      const input = screen.getByDisplayValue('1,000')
      await user.clear(input)
      
      expect(mockOnValueChange).toHaveBeenCalledWith(0)
    })

    it('handles valid numeric input', async () => {
      const props = { ...defaultProps, value: '' }
      renderWithTheme(<NumberEditor {...props} />)
      
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '500' } })
      
      expect(mockOnValueChange).toHaveBeenCalledWith(500)
    })

    it('rejects non-numeric input', async () => {
      const user = userEvent.setup()
      renderWithTheme(<NumberEditor {...defaultProps} />)
      
      const input = screen.getByDisplayValue('1,000')
      await user.clear(input)
      await user.type(input, 'abc')
      
      expect(mockOnValueChange).not.toHaveBeenCalledWith('abc')
    })

    it('applies min value constraint', async () => {
      const props = { ...defaultProps, value: '', min: 10 }
      renderWithTheme(<NumberEditor {...props} />)
      
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '5' } })
      
      expect(mockOnValueChange).toHaveBeenCalledWith(10)
    })

    it('applies max value constraint', async () => {
      const user = userEvent.setup()
      const props = { ...defaultProps, max: 100 }
      renderWithTheme(<NumberEditor {...props} />)
      
      const input = screen.getByDisplayValue('1,000')
      await user.clear(input)
      await user.type(input, '150')
      
      expect(mockOnValueChange).toHaveBeenCalledWith(100)
    })
  })

  describe('useImperativeHandle Methods', () => {
    it('getValue method removes commas', () => {
      const ref = createRef()
      const props = { ...defaultProps, value: '1,234,567' }
      renderWithTheme(<NumberEditor {...props} ref={ref} />)
      
      expect(ref.current.getValue()).toBe('1234567')
    })

    it('isCancelBeforeStart returns false', () => {
      const ref = createRef()
      renderWithTheme(<NumberEditor {...defaultProps} ref={ref} />)
      
      expect(ref.current.isCancelBeforeStart()).toBe(false)
    })

    it('isCancelAfterEnd returns false', () => {
      const ref = createRef()
      renderWithTheme(<NumberEditor {...defaultProps} ref={ref} />)
      
      expect(ref.current.isCancelAfterEnd()).toBe(false)
    })
  })
})