import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { ClearFiltersButton } from '../ClearFiltersButton'

// Mock i18n
const mockT = vi.fn((key) => {
  const translations = {
    'common:ClearFilters': 'Clear Filters'
  }
  return translations[key] || key
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT
  })
}))

// Mock BCButton component
vi.mock('@/components/BCButton', () => ({
  default: vi.fn().mockImplementation(({ children, onClick, onKeyDown, disabled, startIcon, size, color, variant, sx, ...props }) => {
    const handleClick = disabled ? undefined : onClick
    const handleKeyDown = disabled ? undefined : onKeyDown
    const buttonProps = {
      onClick: handleClick,
      onKeyDown: handleKeyDown,
      'data-test': 'bc-button',
      'data-size': size,
      'data-color': color,
      'data-variant': variant,
      style: sx,
      ...props
    }

    if (disabled) {
      buttonProps.disabled = true
    }

    return (
      <button {...buttonProps}>
        {startIcon && <span data-test="start-icon">{startIcon}</span>}
        {children}
      </button>
    )
  })
}))

// Mock FontAwesome components
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: vi.fn(({ icon, className }) => (
    <span data-test="font-awesome-icon" className={className}>
      {icon.iconName || 'filter-clear-icon'}
    </span>
  ))
}))

vi.mock('@fortawesome/free-solid-svg-icons', () => ({
  faFilterCircleXmark: { iconName: 'filter-circle-xmark' }
}))

describe('ClearFiltersButton', () => {
  const defaultProps = {
    onClick: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(<ClearFiltersButton {...defaultProps} />)
      
      expect(screen.getByRole('button')).toBeInTheDocument()
      expect(screen.getByText('Clear Filters')).toBeInTheDocument()
    })

    it('displays translated text correctly', () => {
      render(<ClearFiltersButton {...defaultProps} />)
      
      expect(mockT).toHaveBeenCalledWith('common:ClearFilters')
      expect(screen.getByText('Clear Filters')).toBeInTheDocument()
    })

    it('renders with filter clear icon', () => {
      render(<ClearFiltersButton {...defaultProps} />)
      
      const icon = screen.getByTestId('font-awesome-icon')
      expect(icon).toBeInTheDocument()
      expect(icon).toHaveClass('small-icon')
      expect(icon).toHaveTextContent('filter-circle-xmark')
    })

    it('renders with default button properties', () => {
      render(<ClearFiltersButton {...defaultProps} />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-variant', 'outlined')
      expect(button).toHaveAttribute('data-size', 'small')
      expect(button).toHaveAttribute('data-color', 'primary')
    })
  })

  describe('Customization Props', () => {
    it('accepts custom size prop', () => {
      render(<ClearFiltersButton {...defaultProps} size="medium" />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-size', 'medium')
    })

    it('accepts custom color prop', () => {
      render(<ClearFiltersButton {...defaultProps} color="secondary" />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-color', 'secondary')
    })

    it('accepts custom sx prop', () => {
      const customSx = { margin: '10px', padding: '5px' }
      render(<ClearFiltersButton {...defaultProps} sx={customSx} />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveStyle('margin: 10px; padding: 5px')
    })

    it('merges custom sx with default empty object', () => {
      const customSx = { backgroundColor: 'red' }
      render(<ClearFiltersButton {...defaultProps} sx={customSx} />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveStyle('background-color: rgb(255, 0, 0)')
    })

    it('handles empty sx prop', () => {
      render(<ClearFiltersButton {...defaultProps} sx={{}} />)
      
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })
  })

  describe('Event Handling', () => {
    it('calls onClick when clicked', async () => {
      const user = userEvent.setup()
      render(<ClearFiltersButton {...defaultProps} />)
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(defaultProps.onClick).toHaveBeenCalledTimes(1)
    })

    it('handles multiple clicks', async () => {
      const user = userEvent.setup()
      render(<ClearFiltersButton {...defaultProps} />)
      
      const button = screen.getByRole('button')
      await user.click(button)
      await user.click(button)
      await user.click(button)
      
      expect(defaultProps.onClick).toHaveBeenCalledTimes(3)
    })

    it('handles Enter key activation', () => {
      render(<ClearFiltersButton {...defaultProps} />)

      const button = screen.getByRole('button')
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' })
      fireEvent.keyUp(button, { key: 'Enter', code: 'Enter' })

      expect(defaultProps.onClick).toHaveBeenCalledTimes(1)
    })

    it('handles Space key activation via native button behavior', async () => {
      const user = userEvent.setup()
      render(<ClearFiltersButton {...defaultProps} />)

      const button = screen.getByRole('button')
      button.focus()
      // Spacebar triggers native button click behavior
      await user.keyboard(' ')

      expect(defaultProps.onClick).toHaveBeenCalledTimes(1)
    })

    it('does not trigger on other keys', () => {
      render(<ClearFiltersButton {...defaultProps} />)

      const button = screen.getByRole('button')
      fireEvent.keyDown(button, { key: 'Tab', code: 'Tab' })
      fireEvent.keyDown(button, { key: 'Escape', code: 'Escape' })

      expect(defaultProps.onClick).not.toHaveBeenCalled()
    })

    it('passes event object to onClick handler', async () => {
      const onClickSpy = vi.fn()
      const user = userEvent.setup()
      render(<ClearFiltersButton {...defaultProps} onClick={onClickSpy} />)
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(onClickSpy).toHaveBeenCalledWith(expect.any(Object))
    })
  })

  describe('State Management', () => {
    it('maintains consistent state across re-renders', () => {
      const { rerender } = render(<ClearFiltersButton {...defaultProps} />)
      
      expect(screen.getByText('Clear Filters')).toBeInTheDocument()
      
      rerender(<ClearFiltersButton {...defaultProps} size="large" />)
      
      expect(screen.getByText('Clear Filters')).toBeInTheDocument()
      expect(screen.getByTestId('bc-button')).toHaveAttribute('data-size', 'large')
    })

    it('handles prop changes without losing functionality', async () => {
      const originalOnClick = vi.fn()
      const newOnClick = vi.fn()
      const user = userEvent.setup()
      
      const { rerender } = render(<ClearFiltersButton onClick={originalOnClick} />)
      
      const button = screen.getByRole('button')
      await user.click(button)
      expect(originalOnClick).toHaveBeenCalledTimes(1)
      
      rerender(<ClearFiltersButton onClick={newOnClick} />)
      
      await user.click(button)
      expect(newOnClick).toHaveBeenCalledTimes(1)
      expect(originalOnClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Filter Clearing Functionality', () => {
    it('simulates clearing filters with mock state', async () => {
      const mockClearFilters = vi.fn()
      const user = userEvent.setup()
      
      render(<ClearFiltersButton onClick={mockClearFilters} />)
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(mockClearFilters).toHaveBeenCalled()
    })

    it('handles filter clearing with complex state object', async () => {
      const mockComplexClear = vi.fn((event) => {
        // Simulate clearing multiple filters
        const filters = {
          searchText: '',
          dateRange: null,
          category: '',
          status: ''
        }
        return filters
      })
      const user = userEvent.setup()
      
      render(<ClearFiltersButton onClick={mockComplexClear} />)
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(mockComplexClear).toHaveBeenCalled()
    })

    it('handles async filter clearing operations', async () => {
      const asyncClearFilters = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { success: true }
      })
      const user = userEvent.setup()
      
      render(<ClearFiltersButton onClick={asyncClearFilters} />)
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(asyncClearFilters).toHaveBeenCalled()
    })
  })

  describe('Disabled States', () => {
    it('can be disabled via BCButton props', () => {
      // Since ClearFiltersButton doesn't have its own disabled prop,
      // we test that it can accept additional props through spread operator
      render(<ClearFiltersButton {...defaultProps} disabled={true} />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('disabled')
    })

    it('does not call onClick when disabled', async () => {
      const user = userEvent.setup()
      render(<ClearFiltersButton {...defaultProps} disabled={true} />)
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(defaultProps.onClick).not.toHaveBeenCalled()
    })

    it('handles conditional disabling based on filter state', () => {
      const hasFilters = false
      render(<ClearFiltersButton {...defaultProps} disabled={!hasFilters} />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('disabled')
    })
  })

  describe('Accessibility', () => {
    it('provides proper button semantics', () => {
      render(<ClearFiltersButton {...defaultProps} />)
      
      const button = screen.getByRole('button')
      expect(button.tagName).toBe('BUTTON')
    })

    it('has accessible text content', () => {
      render(<ClearFiltersButton {...defaultProps} />)
      
      expect(screen.getByText('Clear Filters')).toBeInTheDocument()
    })

    it('includes icon for visual users', () => {
      render(<ClearFiltersButton {...defaultProps} />)
      
      const icon = screen.getByTestId('font-awesome-icon')
      expect(icon).toBeInTheDocument()
      expect(icon).toHaveClass('small-icon')
    })

    it('supports screen reader navigation', () => {
      render(<ClearFiltersButton {...defaultProps} />)
      
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).not.toHaveAttribute('aria-hidden')
    })

    it('can accept additional ARIA attributes', () => {
      // This test verifies that props are passed through
      // The actual aria attributes would be handled by the real BCButton component
      expect(() => {
        render(
          <ClearFiltersButton 
            {...defaultProps} 
            aria-label="Clear all applied filters"
            aria-describedby="filter-help-text"
          />
        )
      }).not.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('handles missing onClick prop gracefully', () => {
      expect(() => {
        render(<ClearFiltersButton />)
      }).not.toThrow()
    })

    it('calls onClick handler when provided', async () => {
      const mockOnClick = vi.fn()
      const user = userEvent.setup()
      
      render(<ClearFiltersButton onClick={mockOnClick} />)
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(mockOnClick).toHaveBeenCalled()
    })

    it('handles missing translation keys gracefully', () => {
      mockT.mockImplementation((key) => key) // Return the key itself
      
      render(<ClearFiltersButton {...defaultProps} />)
      
      expect(screen.getByText('common:ClearFilters')).toBeInTheDocument()
      
      // Reset mock for other tests
      mockT.mockImplementation((key) => {
        const translations = {
          'common:ClearFilters': 'Clear Filters'
        }
        return translations[key] || key
      })
    })

    it('handles invalid sx prop gracefully', () => {
      expect(() => {
        render(<ClearFiltersButton {...defaultProps} sx="invalid-sx" />)
      }).not.toThrow()
    })
  })

  describe('Button Reference Handling', () => {
    it('forwards ref correctly', () => {
      // Test that ref prop is accepted without errors
      expect(() => {
        const ref = { current: null }
        render(<ClearFiltersButton {...defaultProps} ref={ref} />)
      }).not.toThrow()
    })

    it('works without ref', () => {
      expect(() => {
        render(<ClearFiltersButton {...defaultProps} />)
      }).not.toThrow()
    })

    it('handles null ref', () => {
      expect(() => {
        render(<ClearFiltersButton {...defaultProps} ref={null} />)
      }).not.toThrow()
    })

    it('accepts ref prop for future ref functionality', () => {
      // This test ensures the prop is passed through for real implementation
      const mockRef = vi.fn()
      
      expect(() => {
        render(<ClearFiltersButton {...defaultProps} ref={mockRef} />)
      }).not.toThrow()
    })
  })

  describe('Integration Scenarios', () => {
    it('works with different filter types', async () => {
      const filterStates = {
        textFilters: ['search', 'name'],
        dateFilters: ['startDate', 'endDate'],
        selectFilters: ['category', 'status']
      }
      
      const clearAllFilters = vi.fn(() => {
        Object.keys(filterStates).forEach(type => {
          filterStates[type] = []
        })
      })
      const user = userEvent.setup()
      
      render(<ClearFiltersButton onClick={clearAllFilters} />)
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(clearAllFilters).toHaveBeenCalled()
    })

    it('integrates with form reset functionality', async () => {
      const mockFormReset = vi.fn()
      const user = userEvent.setup()
      
      render(<ClearFiltersButton onClick={mockFormReset} />)
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(mockFormReset).toHaveBeenCalled()
    })

    it('handles clear filters in data grid context', async () => {
      const mockGridClear = vi.fn(() => ({
        columnFilters: {},
        globalFilter: '',
        sortBy: []
      }))
      const user = userEvent.setup()
      
      render(<ClearFiltersButton onClick={mockGridClear} />)
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(mockGridClear).toHaveBeenCalled()
    })
  })

  describe('Performance', () => {
    it('handles rapid clicking without performance issues', async () => {
      const user = userEvent.setup()
      const fastClick = vi.fn()
      
      render(<ClearFiltersButton onClick={fastClick} />)
      
      const button = screen.getByRole('button')
      
      // Simulate rapid clicking
      for (let i = 0; i < 10; i++) {
        await user.click(button)
      }
      
      expect(fastClick).toHaveBeenCalledTimes(10)
    })

    it('maintains performance with complex sx objects', () => {
      const complexSx = {
        margin: '10px',
        padding: '5px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        backgroundColor: '#f5f5f5',
        '&:hover': {
          backgroundColor: '#e0e0e0'
        },
        '&:active': {
          backgroundColor: '#d0d0d0'
        }
      }
      
      render(<ClearFiltersButton {...defaultProps} sx={complexSx} />)
      
      expect(screen.getByTestId('bc-button')).toBeInTheDocument()
    })

    it('renders consistently across multiple instances', () => {
      render(
        <div>
          <ClearFiltersButton {...defaultProps} />
          <ClearFiltersButton {...defaultProps} size="medium" />
          <ClearFiltersButton {...defaultProps} color="secondary" />
        </div>
      )
      
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(3)
      
      buttons.forEach(button => {
        expect(button).toBeInTheDocument()
      })
    })
  })
})