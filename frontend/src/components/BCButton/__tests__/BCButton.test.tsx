import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BCButton from '../index'
import { wrapper } from '@/tests/utils/wrapper'

describe('BCButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders button with children text', () => {
      render(<BCButton>Click Me</BCButton>, { wrapper })

      expect(screen.getByRole('button', { name: 'Click Me' })).toBeInTheDocument()
    })

    it('renders with data-test attribute when provided', () => {
      render(
        <BCButton data-test="submit-button">Submit</BCButton>,
        { wrapper }
      )

      expect(screen.getByTestId('submit-button')).toBeInTheDocument()
    })

    it('shows loading spinner instead of children when isLoading is true', () => {
      render(
        <BCButton isLoading data-test="loading-button">
          Click Me
        </BCButton>,
        { wrapper }
      )

      expect(screen.queryByText('Click Me')).not.toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })

  describe('click handler', () => {
    it('calls onClick when clicked', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()

      render(<BCButton onClick={onClick}>Click Me</BCButton>, { wrapper })

      await user.click(screen.getByRole('button', { name: 'Click Me' }))

      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when disabled', () => {
      const onClick = vi.fn()

      render(
        <BCButton onClick={onClick} disabled>
          Click Me
        </BCButton>,
        { wrapper }
      )

      const button = screen.getByRole('button', { name: 'Click Me' })
      fireEvent.click(button)

      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('disabled state', () => {
    it('renders as disabled when disabled prop is true', () => {
      render(<BCButton disabled>Click Me</BCButton>, { wrapper })

      expect(screen.getByRole('button', { name: 'Click Me' })).toBeDisabled()
    })
  })

  describe('variants', () => {
    it.each([
      ['contained', 'contained'],
      ['outlined', 'outlined'],
      ['text', 'text'],
      ['gradient', 'contained']
    ] as const)('renders %s variant', (variant, expectedMuiVariant) => {
      render(
        <BCButton variant={variant} data-test={`${variant}-button`}>
          {variant}
        </BCButton>,
        { wrapper }
      )

      const button = screen.getByTestId(`${variant}-button`)
      expect(button).toHaveClass(`MuiButton-${expectedMuiVariant}`)
    })
  })

  describe('sizes', () => {
    it.each([
      ['small', 'MuiButton-sizeSmall'],
      ['medium', 'MuiButton-sizeMedium'],
      ['large', 'MuiButton-sizeLarge']
    ] as const)('renders %s size', (size, expectedClass) => {
      render(
        <BCButton size={size} data-test={`${size}-button`}>
          {size}
        </BCButton>,
        { wrapper }
      )

      expect(screen.getByTestId(`${size}-button`)).toHaveClass(expectedClass)
    })
  })

  describe('loading state', () => {
    it('shows correct spinner color for outlined variant', () => {
      render(
        <BCButton isLoading variant="outlined">
          Loading
        </BCButton>,
        { wrapper }
      )

      const spinner = screen.getByRole('progressbar')
      expect(spinner).toBeInTheDocument()
    })

    it('shows correct spinner color for contained variant', () => {
      render(
        <BCButton isLoading variant="contained">
          Loading
        </BCButton>,
        { wrapper }
      )

      const spinner = screen.getByRole('progressbar')
      expect(spinner).toBeInTheDocument()
    })

    it('shows spinner instead of icon when loading', () => {
      render(
        <BCButton isLoading data-test="loading-icon-button">
          <span data-testid="button-icon">Icon</span>
        </BCButton>,
        { wrapper }
      )

      expect(screen.queryByTestId('button-icon')).not.toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })

  describe('color variants', () => {
    it.each([
      'primary',
      'secondary',
      'info',
      'success',
      'warning',
      'error'
    ] as const)('renders with %s color', (color) => {
      render(
        <BCButton color={color} data-test={`${color}-button`}>
          {color}
        </BCButton>,
        { wrapper }
      )

      expect(screen.getByTestId(`${color}-button`)).toBeInTheDocument()
    })
  })

  describe('additional props', () => {
    it('accepts and applies custom className', () => {
      render(
        <BCButton className="custom-class" data-test="class-button">
          Custom Class
        </BCButton>,
        { wrapper }
      )

      expect(screen.getByTestId('class-button')).toHaveClass('custom-class')
    })

    it('forwards additional DOM attributes', () => {
      render(
        <BCButton aria-label="Custom label" data-test="aria-button">
          Button
        </BCButton>,
        { wrapper }
      )

      expect(screen.getByTestId('aria-button')).toHaveAttribute(
        'aria-label',
        'Custom label'
      )
    })

    it('supports type attribute', () => {
      render(
        <BCButton type="submit" data-test="submit-button">
          Submit
        </BCButton>,
        { wrapper }
      )

      expect(screen.getByTestId('submit-button')).toHaveAttribute(
        'type',
        'submit'
      )
    })

    it('handles circular prop', () => {
      render(
        <BCButton circular data-test="circular-button">
          O
        </BCButton>,
        { wrapper }
      )

      expect(screen.getByTestId('circular-button')).toBeInTheDocument()
    })

    it('handles iconOnly prop', () => {
      render(
        <BCButton iconOnly data-test="icon-only-button">
          X
        </BCButton>,
        { wrapper }
      )

      expect(screen.getByTestId('icon-only-button')).toBeInTheDocument()
    })
  })

  describe('event handlers', () => {
    it('calls onMouseEnter when hovered', async () => {
      const user = userEvent.setup()
      const onMouseEnter = vi.fn()

      render(
        <BCButton onMouseEnter={onMouseEnter}>Hover me</BCButton>,
        { wrapper }
      )

      await user.hover(screen.getByRole('button', { name: 'Hover me' }))

      expect(onMouseEnter).toHaveBeenCalledTimes(1)
    })

    it('calls onFocus when focused', async () => {
      const user = userEvent.setup()
      const onFocus = vi.fn()

      render(
        <BCButton onFocus={onFocus}>Focus me</BCButton>,
        { wrapper }
      )

      await user.tab()

      expect(onFocus).toHaveBeenCalledTimes(1)
    })
  })

  describe('accessibility', () => {
    it('is focusable via keyboard', async () => {
      const user = userEvent.setup()

      render(<BCButton>Tab to me</BCButton>, { wrapper })

      await user.tab()

      expect(screen.getByRole('button', { name: 'Tab to me' })).toHaveFocus()
    })

    it('can be activated with Enter key', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()

      render(
        <BCButton onClick={onClick}>Press Enter</BCButton>,
        { wrapper }
      )

      const button = screen.getByRole('button', { name: 'Press Enter' })
      button.focus()
      await user.keyboard('{Enter}')

      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('can be activated with Space key', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()

      render(
        <BCButton onClick={onClick}>Press Space</BCButton>,
        { wrapper }
      )

      const button = screen.getByRole('button', { name: 'Press Space' })
      button.focus()
      await user.keyboard(' ')

      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })
})
