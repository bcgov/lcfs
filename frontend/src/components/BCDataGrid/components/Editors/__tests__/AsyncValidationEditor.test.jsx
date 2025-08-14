import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme } from '@mui/material/styles'
import { AsyncValidationEditor } from '../AsyncValidationEditor'

// Mock the useDebounce hook
vi.mock('@/utils/debounce', () => ({
  useDebounce: vi.fn((value) => value)
}))

const theme = createTheme()

const renderWithTheme = (component) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  )
}

describe('AsyncValidationEditor', () => {
  let mockOnValueChange
  let mockCondition
  let defaultProps

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    
    mockOnValueChange = vi.fn()
    mockCondition = vi.fn().mockResolvedValue(true)
    
    defaultProps = {
      value: '',
      onValueChange: mockOnValueChange,
      eventKey: 'Enter',
      rowIndex: 0,
      column: { colId: 'testField' },
      debounceLimit: 300,
      condition: mockCondition
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Component Rendering and Initialization', () => {
    it('renders correctly with initial props', () => {
      act(() => {
        renderWithTheme(<AsyncValidationEditor {...defaultProps} />)
      })
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveValue('')
      expect(input).toHaveAttribute('placeholder', 'Enter testField')
    })

    it('renders with provided initial value', () => {
      const props = { ...defaultProps, value: 'test value' }
      act(() => {
        renderWithTheme(<AsyncValidationEditor {...props} />)
      })
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('test value')
    })

    it('generates placeholder text from column.colId', () => {
      const props = { ...defaultProps, column: { colId: 'customField' } }
      act(() => {
        renderWithTheme(<AsyncValidationEditor {...props} />)
      })
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('placeholder', 'Enter customField')
    })
  })

  describe('Input Handler Function', () => {
    it('updates inputValue when input changes', () => {
      act(() => {
        renderWithTheme(<AsyncValidationEditor {...defaultProps} />)
      })
      
      const input = screen.getByRole('textbox')
      act(() => {
        fireEvent.change(input, { target: { value: 'new value' } })
      })
      
      expect(input).toHaveValue('new value')
    })

    it('calls onValueChange when input changes', () => {
      act(() => {
        renderWithTheme(<AsyncValidationEditor {...defaultProps} />)
      })
      
      const input = screen.getByRole('textbox')
      act(() => {
        fireEvent.change(input, { target: { value: 'new value' } })
      })
      
      expect(mockOnValueChange).toHaveBeenCalledWith('new value')
    })

    it('sets touched state to true after input change', () => {
      let rendered
      act(() => {
        rendered = renderWithTheme(<AsyncValidationEditor {...defaultProps} />)
      })
      
      const input = screen.getByRole('textbox')
      
      // Initially untouched - should have no validation indicator
      expect(screen.queryByText('✔')).not.toBeInTheDocument()
      expect(screen.queryByText('✘')).not.toBeInTheDocument()
      
      act(() => {
        fireEvent.change(input, { target: { value: 'test' } })
      })
      
      // After touch, should show loading state
      const loadingElement = rendered.container.querySelector('.loading')
      expect(loadingElement).toBeInTheDocument()
    })

    it('sets validating state to true during input change', () => {
      let rendered
      act(() => {
        rendered = renderWithTheme(<AsyncValidationEditor {...defaultProps} />)
      })
      
      const input = screen.getByRole('textbox')
      act(() => {
        fireEvent.change(input, { target: { value: 'test' } })
      })
      
      // Should show gray color and loading indicator
      expect(input).toHaveStyle({ color: 'rgb(128, 128, 128)' })
      const loadingElement = rendered.container.querySelector('.loading')
      expect(loadingElement).toBeInTheDocument()
    })
  })

  describe('useImperativeHandle Ref Methods', () => {
    it('getValue method returns current inputValue', () => {
      const ref = createRef()
      act(() => {
        renderWithTheme(<AsyncValidationEditor {...defaultProps} ref={ref} />)
      })
      
      const input = screen.getByRole('textbox')
      act(() => {
        fireEvent.change(input, { target: { value: 'test value' } })
      })
      
      expect(ref.current.getValue()).toBe('test value')
    })

    it('afterGuiAttached method sets inputValue to initial value', () => {
      const ref = createRef()
      const props = { ...defaultProps, value: 'initial value' }
      act(() => {
        renderWithTheme(<AsyncValidationEditor {...props} ref={ref} />)
      })
      
      // Change the input value
      const input = screen.getByRole('textbox')
      act(() => {
        fireEvent.change(input, { target: { value: 'changed value' } })
      })
      expect(input).toHaveValue('changed value')
      
      // Call afterGuiAttached should reset to initial value
      act(() => {
        ref.current.afterGuiAttached()
      })
      
      expect(input).toHaveValue('initial value')
    })

    it('isCancelAfterEnd returns true when invalid', async () => {
      const ref = createRef()
      mockCondition.mockResolvedValue(false)
      act(() => {
        renderWithTheme(<AsyncValidationEditor {...defaultProps} ref={ref} />)
      })
      
      const input = screen.getByRole('textbox')
      act(() => {
        fireEvent.change(input, { target: { value: 'invalid' } })
      })
      
      await act(async () => {
        vi.advanceTimersByTime(300)
        await vi.runAllTimersAsync()
      })
      
      expect(ref.current.isCancelAfterEnd()).toBe(true)
    })

    it('isCancelAfterEnd returns true when validating', () => {
      const ref = createRef()
      act(() => {
        renderWithTheme(<AsyncValidationEditor {...defaultProps} ref={ref} />)
      })
      
      const input = screen.getByRole('textbox')
      act(() => {
        fireEvent.change(input, { target: { value: 'test' } })
      })
      
      // While validating, should return true
      expect(ref.current.isCancelAfterEnd()).toBe(true)
    })

    it('isCancelAfterEnd returns false when valid and not validating', async () => {
      const ref = createRef()
      mockCondition.mockResolvedValue(true)
      act(() => {
        renderWithTheme(<AsyncValidationEditor {...defaultProps} ref={ref} />)
      })
      
      const input = screen.getByRole('textbox')
      act(() => {
        fireEvent.change(input, { target: { value: 'valid' } })
      })
      
      await act(async () => {
        vi.advanceTimersByTime(300)
        await vi.runAllTimersAsync()
      })
      
      expect(ref.current.isCancelAfterEnd()).toBe(false)
    })
  })

  describe('Validation State Rendering', () => {
    it('renders success indicator when valid', async () => {
      mockCondition.mockResolvedValue(true)
      act(() => {
        renderWithTheme(<AsyncValidationEditor {...defaultProps} />)
      })
      
      const input = screen.getByRole('textbox')
      act(() => {
        fireEvent.change(input, { target: { value: 'valid input' } })
      })
      
      await act(async () => {
        vi.advanceTimersByTime(300)
        await vi.runAllTimersAsync()
      })
      
      expect(screen.getByText('✔')).toBeInTheDocument()
      expect(input).toHaveStyle({ color: 'rgb(0, 0, 0)' })
    })

    it('renders fail indicator when invalid', async () => {
      mockCondition.mockResolvedValue(false)
      act(() => {
        renderWithTheme(<AsyncValidationEditor {...defaultProps} />)
      })
      
      const input = screen.getByRole('textbox')
      act(() => {
        fireEvent.change(input, { target: { value: 'invalid input' } })
      })
      
      await act(async () => {
        vi.advanceTimersByTime(300)
        await vi.runAllTimersAsync()
      })
      
      expect(screen.getByText('✘')).toBeInTheDocument()
      expect(input).toHaveStyle({ color: 'rgb(233, 30, 99)' })
    })

    it('renders loading indicator when validating', () => {
      let rendered
      act(() => {
        rendered = renderWithTheme(<AsyncValidationEditor {...defaultProps} />)
      })
      
      const input = screen.getByRole('textbox')
      act(() => {
        fireEvent.change(input, { target: { value: 'test' } })
      })
      
      const loadingElement = rendered.container.querySelector('.loading')
      expect(loadingElement).toBeInTheDocument()
      expect(input).toHaveStyle({ color: 'rgb(128, 128, 128)' })
    })

    it('renders no indicator when untouched', () => {
      let rendered
      act(() => {
        rendered = renderWithTheme(<AsyncValidationEditor {...defaultProps} />)
      })
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveStyle({ color: 'rgb(0, 0, 0)' })
      expect(screen.queryByText('✔')).not.toBeInTheDocument()
      expect(screen.queryByText('✘')).not.toBeInTheDocument()
      expect(rendered.container.querySelector('.loading')).not.toBeInTheDocument()
    })
  })

  describe('useEffect Validation Logic', () => {
    it('resolves false immediately for empty inputValue', async () => {
      act(() => {
        renderWithTheme(<AsyncValidationEditor {...defaultProps} />)
      })
      
      const input = screen.getByRole('textbox')
      
      // First make it non-empty to trigger touched state
      act(() => {
        fireEvent.change(input, { target: { value: 'temp' } })
      })
      
      // Wait for first validation to complete
      await act(async () => {
        vi.advanceTimersByTime(300)
        await vi.runAllTimersAsync()
      })
      
      // Clear mock calls from the temp input
      mockCondition.mockClear()
      
      // Then clear it
      act(() => {
        fireEvent.change(input, { target: { value: '' } })
      })
      
      await act(async () => {
        vi.advanceTimersByTime(300)
        await vi.runAllTimersAsync()
      })
      
      expect(mockCondition).not.toHaveBeenCalled()
      expect(screen.getByText('✘')).toBeInTheDocument()
    })

    it('calls condition function for non-empty inputValue', async () => {
      act(() => {
        renderWithTheme(<AsyncValidationEditor {...defaultProps} />)
      })
      
      const input = screen.getByRole('textbox')
      act(() => {
        fireEvent.change(input, { target: { value: 'test input' } })
      })
      
      await act(async () => {
        vi.advanceTimersByTime(300)
        await vi.runAllTimersAsync()
      })
      
      expect(mockCondition).toHaveBeenCalledWith('test input')
    })

    it('updates valid state on successful validation', async () => {
      mockCondition.mockResolvedValue(true)
      act(() => {
        renderWithTheme(<AsyncValidationEditor {...defaultProps} />)
      })
      
      const input = screen.getByRole('textbox')
      act(() => {
        fireEvent.change(input, { target: { value: 'valid input' } })
      })
      
      await act(async () => {
        vi.advanceTimersByTime(300)
        await vi.runAllTimersAsync()
      })
      
      expect(screen.getByText('✔')).toBeInTheDocument()
    })

    it('updates valid state on failed validation', async () => {
      mockCondition.mockResolvedValue(false)
      act(() => {
        renderWithTheme(<AsyncValidationEditor {...defaultProps} />)
      })
      
      const input = screen.getByRole('textbox')
      act(() => {
        fireEvent.change(input, { target: { value: 'invalid input' } })
      })
      
      await act(async () => {
        vi.advanceTimersByTime(300)
        await vi.runAllTimersAsync()
      })
      
      expect(screen.getByText('✘')).toBeInTheDocument()
    })

    it('handles validation errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const testError = new Error('Validation error')
      mockCondition.mockRejectedValue(testError)
      
      act(() => {
        renderWithTheme(<AsyncValidationEditor {...defaultProps} />)
      })
      
      const input = screen.getByRole('textbox')
      act(() => {
        fireEvent.change(input, { target: { value: 'test input' } })
      })
      
      await act(async () => {
        vi.advanceTimersByTime(300)
        await vi.runAllTimersAsync()
      })
      
      expect(consoleSpy).toHaveBeenCalledWith(testError)
      consoleSpy.mockRestore()
    })

    it('sets validating to false after validation completes', async () => {
      mockCondition.mockResolvedValue(true)
      act(() => {
        renderWithTheme(<AsyncValidationEditor {...defaultProps} />)
      })
      
      const input = screen.getByRole('textbox')
      act(() => {
        fireEvent.change(input, { target: { value: 'test input' } })
      })
      
      // Initially validating
      expect(input).toHaveStyle({ color: 'rgb(128, 128, 128)' })
      
      await act(async () => {
        vi.advanceTimersByTime(300)
        await vi.runAllTimersAsync()
      })
      
      // After validation, not validating
      expect(input).toHaveStyle({ color: 'rgb(0, 0, 0)' })
      expect(screen.getByText('✔')).toBeInTheDocument()
    })
  })
})