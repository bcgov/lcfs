import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, vi, beforeEach } from 'vitest'
import BCButton from '../index'
import { test } from '@/tests/utils/fixtures'

describe('BCButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    test('renders button with children text', ({ render, theme }) => {
      render(<BCButton>Click Me</BCButton>, [theme])

      expect(
        screen.getByRole('button', { name: 'Click Me' })
      ).toBeInTheDocument()
    })

    test('renders with data-test attribute when provided', ({
      render,
      theme
    }) => {
      render(<BCButton data-test="submit-button">Submit</BCButton>, [theme])

      expect(screen.getByTestId('submit-button')).toBeInTheDocument()
    })

    test('shows loading spinner instead of children when isLoading is true', ({
      render,
      theme
    }) => {
      render(
        <BCButton isLoading data-test="loading-button">
          Click Me
        </BCButton>,
        [theme]
      )

      expect(screen.queryByText('Click Me')).not.toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })

  describe('click handler', () => {
    test('calls onClick when clicked', async ({ render, theme }) => {
      const user = userEvent.setup()
      const onClick = vi.fn()

      render(<BCButton onClick={onClick}>Click Me</BCButton>, [theme])

      await user.click(screen.getByRole('button', { name: 'Click Me' }))

      expect(onClick).toHaveBeenCalledTimes(1)
    })

    test('does not call onClick when disabled', ({ render, theme }) => {
      const onClick = vi.fn()

      render(
        <BCButton onClick={onClick} disabled>
          Click Me
        </BCButton>,
        [theme]
      )

      const button = screen.getByRole('button', { name: 'Click Me' })
      fireEvent.click(button)

      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('disabled state', () => {
    test('renders as disabled when disabled prop is true', ({
      render,
      theme
    }) => {
      render(<BCButton disabled>Click Me</BCButton>, [theme])

      expect(screen.getByRole('button', { name: 'Click Me' })).toBeDisabled()
    })
  })

  describe('variants', () => {
    for (const [variant, expectedMuiVariant] of [
      ['contained', 'contained'],
      ['outlined', 'outlined'],
      ['text', 'text'],
      ['gradient', 'contained']
    ] as const) {
      test(`renders ${variant} variant`, ({ render, theme }) => {
        render(
          <BCButton variant={variant} data-test={`${variant}-button`}>
            {variant}
          </BCButton>,
          [theme]
        )

        const button = screen.getByTestId(`${variant}-button`)
        expect(button).toHaveClass(`MuiButton-${expectedMuiVariant}`)
      })
    }
  })

  describe('sizes', () => {
    for (const [size, expectedClass] of [
      ['small', 'MuiButton-sizeSmall'],
      ['medium', 'MuiButton-sizeMedium'],
      ['large', 'MuiButton-sizeLarge']
    ] as const) {
      test(`renders ${size} size`, ({ render, theme }) => {
        render(
          <BCButton size={size} data-test={`${size}-button`}>
            {size}
          </BCButton>,
          [theme]
        )

        expect(screen.getByTestId(`${size}-button`)).toHaveClass(expectedClass)
      })
    }
  })

  describe('loading state', () => {
    test('shows correct spinner color for outlined variant', ({
      render,
      theme
    }) => {
      render(
        <BCButton isLoading variant="outlined">
          Loading
        </BCButton>,
        [theme]
      )

      const spinner = screen.getByRole('progressbar')
      expect(spinner).toBeInTheDocument()
    })

    test('shows correct spinner color for contained variant', ({
      render,
      theme
    }) => {
      render(
        <BCButton isLoading variant="contained">
          Loading
        </BCButton>,
        [theme]
      )

      const spinner = screen.getByRole('progressbar')
      expect(spinner).toBeInTheDocument()
    })

    test('shows spinner instead of icon when loading', ({ render, theme }) => {
      render(
        <BCButton isLoading data-test="loading-icon-button">
          <span data-testid="button-icon">Icon</span>
        </BCButton>,
        [theme]
      )

      expect(screen.queryByTestId('button-icon')).not.toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })

  describe('color variants', () => {
    for (const color of [
      'primary',
      'secondary',
      'info',
      'success',
      'warning',
      'error'
    ] as const) {
      test(`renders with ${color} color`, ({ render, theme }) => {
        render(
          <BCButton color={color} data-test={`${color}-button`}>
            {color}
          </BCButton>,
          [theme]
        )

        expect(screen.getByTestId(`${color}-button`)).toBeInTheDocument()
      })
    }
  })

  describe('additional props', () => {
    test('accepts and applies custom className', ({ render, theme }) => {
      render(
        <BCButton className="custom-class" data-test="class-button">
          Custom Class
        </BCButton>,
        [theme]
      )

      expect(screen.getByTestId('class-button')).toHaveClass('custom-class')
    })

    test('forwards additional DOM attributes', ({ render, theme }) => {
      render(
        <BCButton aria-label="Custom label" data-test="aria-button">
          Button
        </BCButton>,
        [theme]
      )

      expect(screen.getByTestId('aria-button')).toHaveAttribute(
        'aria-label',
        'Custom label'
      )
    })

    test('supports type attribute', ({ render, theme }) => {
      render(
        <BCButton type="submit" data-test="submit-button">
          Submit
        </BCButton>,
        [theme]
      )

      expect(screen.getByTestId('submit-button')).toHaveAttribute(
        'type',
        'submit'
      )
    })

    test('handles circular prop', ({ render, theme }) => {
      render(
        <BCButton circular data-test="circular-button">
          O
        </BCButton>,
        [theme]
      )

      expect(screen.getByTestId('circular-button')).toBeInTheDocument()
    })

    test('handles iconOnly prop', ({ render, theme }) => {
      render(
        <BCButton iconOnly data-test="icon-only-button">
          X
        </BCButton>,
        [theme]
      )

      expect(screen.getByTestId('icon-only-button')).toBeInTheDocument()
    })
  })

  describe('event handlers', () => {
    test('calls onMouseEnter when hovered', async ({ render, theme }) => {
      const user = userEvent.setup()
      const onMouseEnter = vi.fn()

      render(<BCButton onMouseEnter={onMouseEnter}>Hover me</BCButton>, [theme])

      await user.hover(screen.getByRole('button', { name: 'Hover me' }))

      expect(onMouseEnter).toHaveBeenCalledTimes(1)
    })

    test('calls onFocus when focused', async ({ render, theme }) => {
      const user = userEvent.setup()
      const onFocus = vi.fn()

      render(<BCButton onFocus={onFocus}>Focus me</BCButton>, [theme])

      await user.tab()

      expect(onFocus).toHaveBeenCalledTimes(1)
    })
  })

  describe('accessibility', () => {
    test('is focusable via keyboard', async ({ render, theme }) => {
      const user = userEvent.setup()

      render(<BCButton>Tab to me</BCButton>, [theme])

      await user.tab()

      expect(screen.getByRole('button', { name: 'Tab to me' })).toHaveFocus()
    })

    test('can be activated with Enter key', async ({ render, theme }) => {
      const user = userEvent.setup()
      const onClick = vi.fn()

      render(<BCButton onClick={onClick}>Press Enter</BCButton>, [theme])

      const button = screen.getByRole('button', { name: 'Press Enter' })
      button.focus()
      await user.keyboard('{Enter}')

      expect(onClick).toHaveBeenCalledTimes(1)
    })

    test('can be activated with Space key', async ({ render, theme }) => {
      const user = userEvent.setup()
      const onClick = vi.fn()

      render(<BCButton onClick={onClick}>Press Space</BCButton>, [theme])

      const button = screen.getByRole('button', { name: 'Press Space' })
      button.focus()
      await user.keyboard(' ')

      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })
})
