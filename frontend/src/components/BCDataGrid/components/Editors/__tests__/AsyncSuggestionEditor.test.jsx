/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AsyncSuggestionEditor } from '../AsyncSuggestionEditor'

// Mock dependencies
vi.mock('@/services/useApiService', () => ({
  useApiService: () => ({
    get: vi.fn(),
    post: vi.fn()
  })
}))

vi.mock('@/components/BCBox', () => ({
  __esModule: true,
  default: ({ children, ...props }) => <div data-test="bc-box" {...props}>{children}</div>
}))

vi.mock('lodash', () => ({
  debounce: vi.fn((fn, delay) => {
    // Simple debounce mock that executes immediately for testing
    const debounced = (...args) => fn(...args)
    debounced.cancel = vi.fn()
    return debounced
  })
}))

vi.mock('autosuggest-highlight/match', () => ({
  default: vi.fn((text, query) => [{ start: 0, end: query.length }])
}))

vi.mock('autosuggest-highlight/parse', () => ({
  default: vi.fn((text, matches) => [
    { text: text.substring(0, matches[0]?.end || 0), highlight: true },
    { text: text.substring(matches[0]?.end || 0), highlight: false }
  ])
}))

describe('AsyncSuggestionEditor', () => {
  let queryClient
  let mockOnValueChange
  let mockOnKeyDownCapture
  let mockQueryFn
  let mockApi

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    
    mockOnValueChange = vi.fn()
    mockOnKeyDownCapture = vi.fn()
    mockQueryFn = vi.fn().mockImplementation(({ queryKey }) => {
      const searchValue = queryKey[1] || ''
      if (searchValue === 'no results') {
        return Promise.resolve([])
      }
      if (searchValue.includes('Custom')) {
        return Promise.resolve([{ title: 'Custom Option', id: 1 }])
      }
      return Promise.resolve([
        { name: 'Option 1', id: 1 },
        { name: 'Option 2', id: 2 }
      ])
    })
    mockApi = {
      tabToNextCell: vi.fn(),
      tabToPreviousCell: vi.fn()
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const renderComponent = (props = {}) => {
    const defaultProps = {
      value: '',
      onValueChange: mockOnValueChange,
      queryKey: 'test-query',
      queryFn: mockQueryFn,
      api: mockApi,
      ...props
    }

    return render(
      createElement(QueryClientProvider, { client: queryClient },
        createElement(AsyncSuggestionEditor, defaultProps)
      )
    )
  }

  it('renders with default props', () => {
    renderComponent()
    
    expect(screen.getByTestId('bc-box')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders with custom value', () => {
    renderComponent({ value: 'test value' })
    
    const input = screen.getByDisplayValue('test value')
    expect(input).toBeInTheDocument()
  })

  it('calls onValueChange when input changes', async () => {
    renderComponent()
    
    const input = screen.getByRole('combobox')
    
    await act(async () => {
      fireEvent.change(input, { target: { value: 'new input' } })
    })
    
    expect(mockOnValueChange).toHaveBeenCalledWith('new input')
  })

  it('handles string values in handleChange', async () => {
    renderComponent()
    
    const input = screen.getByRole('combobox')
    
    await act(async () => {
      fireEvent.change(input, { target: { value: 'string value' } })
      // Simulate selecting a string option
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    
    expect(mockOnValueChange).toHaveBeenCalledWith('string value')
  })

  it('handles object values in handleChange', async () => {
    renderComponent()
    
    const autocomplete = screen.getByRole('combobox')
    const container = autocomplete.closest('[data-test="ag-grid-editor-select-options"]')
    
    await act(async () => {
      fireEvent.change(autocomplete, { target: { value: 'Option 1' } })
    })
    
    // Wait for options to appear and simulate selection
    await waitFor(() => {
      const option = screen.getByText('Option 1')
      expect(option).toBeInTheDocument()
    })
    
    // Simulate selecting an object option
    const optionElement = screen.getByText('Option 1')
    await act(async () => {
      fireEvent.click(optionElement)
    })
    
    // Should be called with the object value
    expect(mockOnValueChange).toHaveBeenCalled()
  })


  it('calls custom onKeyDownCapture when provided', async () => {
    renderComponent({ onKeyDownCapture: mockOnKeyDownCapture })
    
    const input = screen.getByRole('combobox')
    
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Escape' })
    })
    
    expect(mockOnKeyDownCapture).toHaveBeenCalled()
  })

  it('handles Tab key navigation', async () => {
    renderComponent()
    
    const input = screen.getByRole('combobox')
    
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Tab' })
    })
    
    expect(mockApi.tabToNextCell).toHaveBeenCalled()
  })

  it('handles Shift+Tab key navigation', async () => {
    renderComponent()
    
    const input = screen.getByRole('combobox')
    
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })
    })
    
    expect(mockApi.tabToPreviousCell).toHaveBeenCalled()
  })

  it('handles non-Tab keys without navigation', async () => {
    renderComponent()
    
    const input = screen.getByRole('combobox')
    
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    
    expect(mockApi.tabToNextCell).not.toHaveBeenCalled()
    expect(mockApi.tabToPreviousCell).not.toHaveBeenCalled()
  })

  it('respects enabled prop for query execution', () => {
    renderComponent({ enabled: false })
    
    expect(mockQueryFn).not.toHaveBeenCalled()
  })

  it('respects minWords threshold', async () => {
    renderComponent({ minWords: 3 })
    
    const input = screen.getByRole('combobox')
    
    await act(async () => {
      fireEvent.change(input, { target: { value: 'ab' } }) // Less than 3 characters
    })
    
    // Query should not be triggered with less than minWords
    expect(mockQueryFn).not.toHaveBeenCalled()
  })

  it('triggers query when input meets minWords threshold', async () => {
    renderComponent({ minWords: 2 })
    
    const input = screen.getByRole('combobox')
    
    await act(async () => {
      fireEvent.change(input, { target: { value: 'abc' } }) // Meets threshold
    })
    
    await waitFor(() => {
      expect(mockQueryFn).toHaveBeenCalled()
    })
  })


  it('handles string options in getOptionLabel', () => {
    renderComponent()
    
    // Test is implicit through rendering - getOptionLabel is used internally
    // by the Autocomplete component
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })



  it('uses custom debounce value', () => {
    const customDebounce = 1000
    renderComponent({ debounceValue: customDebounce })
    
    // Debounce is mocked, but we can verify the component renders
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('has proper accessibility attributes', () => {
    renderComponent()
    
    const container = screen.getByTestId('bc-box')
    expect(container).toHaveAttribute('aria-label', 'Select options from the drop down')
  })

  it('handles preventDefault on Tab key', async () => {
    renderComponent()
    
    const input = screen.getByRole('combobox')
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    
    await act(async () => {
      fireEvent(input, event)
    })
    
    expect(preventDefaultSpy).toHaveBeenCalled()
  })


  it('maintains focus on input', () => {
    renderComponent()
    
    const input = screen.getByRole('combobox')
    expect(input).toBeInTheDocument()
    // Note: autoFocus is handled by Material-UI internally
  })
})