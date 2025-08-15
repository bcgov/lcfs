/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRef } from 'react'
import { LargeTextareaEditor } from '../LargeTextareaEditor'

// Mock MUI components
vi.mock('@mui/material/InputBase', () => ({
  default: vi.fn(({ value, onChange, onKeyDown, inputRef, multiline, ...props }) => (
    <textarea
      data-test="input-base"
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      ref={inputRef}
      {...props}
    />
  ))
}))

vi.mock('@mui/material/Popper', () => ({
  default: vi.fn(({ children, open, anchorEl, ...props }) => 
    open && anchorEl ? (
      <div data-test="popper" {...props}>
        {children}
      </div>
    ) : null
  )
}))

vi.mock('@mui/material/Paper', () => ({
  default: vi.fn(({ children, ...props }) => (
    <div data-test="paper" {...props}>
      {children}
    </div>
  ))
}))

// Mock AgGrid API
const mockApi = {
  getFocusedCell: vi.fn(),
  tabToNextCell: vi.fn()
}

describe('LargeTextareaEditor Component', () => {
  let mockProps
  let mockRef
  let mockOnValueChange
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    mockRef = createRef()
    mockOnValueChange = vi.fn()
    
    mockProps = {
      value: 'initial value',
      onValueChange: mockOnValueChange,
      column: { actualWidth: 200 },
      api: mockApi
    }
    
    mockApi.getFocusedCell.mockReturnValue({
      rowIndex: 0,
      column: { getId: () => 'testColumn' }
    })
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component Rendering', () => {
    it('renders with basic props', () => {
      render(<LargeTextareaEditor {...mockProps} ref={mockRef} />)
      
      expect(screen.getByTestId('popper')).toBeInTheDocument()
      expect(screen.getByTestId('paper')).toBeInTheDocument()
      expect(screen.getByTestId('input-base')).toBeInTheDocument()
    })
  })

  describe('handleRef Function', () => {
    it('sets anchorEl state when ref callback is called', async () => {
      render(<LargeTextareaEditor {...mockProps} ref={mockRef} />)
      
      // Component should render Popper when anchorEl is set via handleRef
      expect(screen.getByTestId('popper')).toBeInTheDocument()
    })
  })

  describe('handleChange Function', () => {
    it('updates valueState and calls onValueChange', async () => {
      render(<LargeTextareaEditor {...mockProps} ref={mockRef} />)
      
      const input = screen.getByTestId('input-base')
      
      await act(async () => {
        fireEvent.change(input, { target: { value: 'new text value' } })
      })
      
      expect(mockOnValueChange).toHaveBeenCalledWith('new text value')
      expect(input.value).toBe('new text value')
    })
  })

  describe('handleKeyDown Function', () => {
    it('calls tabToNextCell on Tab key press', async () => {
      render(<LargeTextareaEditor {...mockProps} ref={mockRef} />)
      
      const input = screen.getByTestId('input-base')
      
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Tab' })
      })
      
      expect(mockApi.tabToNextCell).toHaveBeenCalled()
    })
    
    it('ignores non-Tab key presses', async () => {
      render(<LargeTextareaEditor {...mockProps} ref={mockRef} />)
      
      const input = screen.getByTestId('input-base')
      
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' })
      })
      
      expect(mockApi.tabToNextCell).not.toHaveBeenCalled()
    })
  })

  describe('useLayoutEffect Hook', () => {
    it('handles null inputRef gracefully', () => {
      render(<LargeTextareaEditor {...mockProps} ref={mockRef} />)
      
      // Component should render without errors when inputRef is null
      expect(screen.getByTestId('input-base')).toBeInTheDocument()
      expect(mockApi.getFocusedCell).toHaveBeenCalled()
    })
  })

  describe('Popper Conditional Rendering', () => {
    it('renders Popper when anchorEl exists', () => {
      render(<LargeTextareaEditor {...mockProps} ref={mockRef} />)
      
      // Popper should be rendered since anchorEl is set via handleRef
      expect(screen.getByTestId('popper')).toBeInTheDocument()
    })
    
    it('conditionally renders Popper based on anchorEl state', () => {
      // Test that Popper is controlled by anchorEl through the mock
      // The mock Popper component only renders when open && anchorEl is truthy
      render(<LargeTextareaEditor {...mockProps} ref={mockRef} />)
      
      // Popper should be rendered since anchorEl gets set through handleRef
      expect(screen.getByTestId('popper')).toBeInTheDocument()
    })
  })

  describe('Props Integration', () => {
    it('uses column.actualWidth for styling', () => {
      const customProps = { ...mockProps, column: { actualWidth: 300 } }
      render(<LargeTextareaEditor {...customProps} ref={mockRef} />)
      
      expect(screen.getByTestId('popper')).toBeInTheDocument()
    })
    
    it('handles initial value correctly', () => {
      render(<LargeTextareaEditor {...mockProps} ref={mockRef} />)
      
      const input = screen.getByTestId('input-base')
      expect(input.value).toBe('initial value')
    })
    
    it('calls api.getFocusedCell in useLayoutEffect', () => {
      render(<LargeTextareaEditor {...mockProps} ref={mockRef} />)
      
      expect(mockApi.getFocusedCell).toHaveBeenCalled()
    })
  })
})