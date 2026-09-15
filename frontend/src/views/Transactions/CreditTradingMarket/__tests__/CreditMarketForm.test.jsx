import React from 'react'
import { screen, fireEvent, act } from '@testing-library/react'
import { vi, describe, expect, beforeEach } from 'vitest'
import { CreditMarketForm } from '../CreditMarketForm'
import { test } from '@/tests/utils/fixtures'

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => {
      const translations = {
        'creditMarket:manageListing': 'Manage your credit market listing',
        'creditMarket:addListing': 'Add listing',
        'creditMarket:creditsAvailable': 'Credits available'
      }
      return translations[key] || fallback || key
    }
  })
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: { id: 1, name: 'Test User' } })
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => (
    <div data-test="bc-typography" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCButton', () => ({
  default: ({ children, onClick, startIcon, ...props }) => (
    <button data-test="bc-button" onClick={onClick} {...props}>
      {startIcon && <span data-test="start-icon">{startIcon}</span>}
      {children}
    </button>
  )
}))

// Mock console.log to verify function calls
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

describe('CreditMarketForm', () => {
  beforeEach(() => {
    consoleSpy.mockClear()
  })

  describe('Initial Render', () => {
    test('should render component with initial state', ({ render }) => {
      render(<CreditMarketForm />)

      expect(
        screen.getByText('Manage your credit market listing')
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /add listing/i })
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Your organization is not currently listed/)
      ).toBeInTheDocument()
    })

    test('should initialize form data with empty values', ({ render }) => {
      render(<CreditMarketForm />)

      // Add listing button should be present indicating no existing data
      expect(
        screen.getByRole('button', { name: /add listing/i })
      ).toBeInTheDocument()
    })
  })

  describe('handleAddListing Function', () => {
    test('should show form when add listing button is clicked', async ({
      render
    }) => {
      render(<CreditMarketForm />)

      const addButton = screen.getByRole('button', { name: /add listing/i })

      await act(async () => {
        fireEvent.click(addButton)
      })

      expect(screen.getByLabelText(/contact person/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/credits available/i)).toBeInTheDocument()
    })

    test('should enable editing mode when add listing is clicked', async ({
      render
    }) => {
      render(<CreditMarketForm />)

      const addButton = screen.getByRole('button', { name: /add listing/i })

      await act(async () => {
        fireEvent.click(addButton)
      })

      // Save and Cancel buttons should be visible in editing mode
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /cancel/i })
      ).toBeInTheDocument()
    })
  })

  describe('handleInputChange Function', () => {
    test('should handle text input changes', async ({ render }) => {
      render(<CreditMarketForm />)

      // Show form first
      const addButton = screen.getByRole('button', { name: /add listing/i })
      await act(async () => {
        fireEvent.click(addButton)
      })

      const contactInput = screen.getByLabelText(/contact person/i)

      await act(async () => {
        fireEvent.change(contactInput, { target: { value: 'John Doe' } })
      })

      expect(contactInput.value).toBe('John Doe')
    })

    test('should handle checkbox input changes', async ({ render }) => {
      render(<CreditMarketForm />)

      // Show form first
      const addButton = screen.getByRole('button', { name: /add listing/i })
      await act(async () => {
        fireEvent.click(addButton)
      })

      const creditsCheckbox = screen.getByLabelText(/credits available/i)

      await act(async () => {
        fireEvent.click(creditsCheckbox)
      })

      expect(creditsCheckbox.checked).toBe(true)
    })

    test('should handle email input changes', async ({ render }) => {
      render(<CreditMarketForm />)

      // Show form first
      const addButton = screen.getByRole('button', { name: /add listing/i })
      await act(async () => {
        fireEvent.click(addButton)
      })

      const emailInput = screen.getByLabelText(/email/i)

      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      })

      expect(emailInput.value).toBe('test@example.com')
    })

    test('should handle phone input changes', async ({ render }) => {
      render(<CreditMarketForm />)

      // Show form first
      const addButton = screen.getByRole('button', { name: /add listing/i })
      await act(async () => {
        fireEvent.click(addButton)
      })

      const phoneInput = screen.getByLabelText(/phone/i)

      await act(async () => {
        fireEvent.change(phoneInput, { target: { value: '123-456-7890' } })
      })

      expect(phoneInput.value).toBe('123-456-7890')
    })
  })

  describe('handleSave Function', () => {
    test('should call console.log when save is clicked', async ({ render }) => {
      render(<CreditMarketForm />)

      // Show form first
      const addButton = screen.getByRole('button', { name: /add listing/i })
      await act(async () => {
        fireEvent.click(addButton)
      })

      const saveButton = screen.getByRole('button', { name: /save/i })

      await act(async () => {
        fireEvent.click(saveButton)
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        'Saving credit market listing:',
        expect.any(Object)
      )
    })
  })

  describe('Additional Coverage Tests', () => {
    test('should handle checkbox change correctly', async ({ render }) => {
      render(<CreditMarketForm />)

      // Show form first
      const addButton = screen.getByRole('button', { name: /add listing/i })
      await act(async () => {
        fireEvent.click(addButton)
      })

      const creditsCheckbox = screen.getByLabelText(/credits available/i)

      // Test checking the box
      await act(async () => {
        fireEvent.click(creditsCheckbox)
      })

      expect(creditsCheckbox.checked).toBe(true)

      // Test unchecking the box
      await act(async () => {
        fireEvent.click(creditsCheckbox)
      })

      expect(creditsCheckbox.checked).toBe(false)
    })

    test('should handle multiple input changes in sequence', async ({
      render
    }) => {
      render(<CreditMarketForm />)

      // Show form first
      const addButton = screen.getByRole('button', { name: /add listing/i })
      await act(async () => {
        fireEvent.click(addButton)
      })

      const contactInput = screen.getByLabelText(/contact person/i)
      const emailInput = screen.getByLabelText(/email/i)
      const phoneInput = screen.getByLabelText(/phone/i)

      // Fill all fields
      await act(async () => {
        fireEvent.change(contactInput, { target: { value: 'Jane Smith' } })
        fireEvent.change(emailInput, { target: { value: 'jane@example.com' } })
        fireEvent.change(phoneInput, { target: { value: '555-0123' } })
      })

      expect(contactInput.value).toBe('Jane Smith')
      expect(emailInput.value).toBe('jane@example.com')
      expect(phoneInput.value).toBe('555-0123')
    })

    test('should verify form field types and attributes', async ({
      render
    }) => {
      render(<CreditMarketForm />)

      // Show form first
      const addButton = screen.getByRole('button', { name: /add listing/i })
      await act(async () => {
        fireEvent.click(addButton)
      })

      const contactInput = screen.getByLabelText(/contact person/i)
      const emailInput = screen.getByLabelText(/email/i)
      const phoneInput = screen.getByLabelText(/phone/i)
      const creditsCheckbox = screen.getByLabelText(/credits available/i)

      expect(contactInput.type).toBe('text')
      expect(emailInput.type).toBe('email')
      expect(phoneInput.type).toBe('text')
      expect(creditsCheckbox.type).toBe('checkbox')

      expect(contactInput.required).toBe(true)
      expect(emailInput.required).toBe(true)
      expect(phoneInput.required).toBe(true)
    })

    test('should handle empty input changes', async ({ render }) => {
      render(<CreditMarketForm />)

      // Show form first
      const addButton = screen.getByRole('button', { name: /add listing/i })
      await act(async () => {
        fireEvent.click(addButton)
      })

      const contactInput = screen.getByLabelText(/contact person/i)

      // Set value then clear it
      await act(async () => {
        fireEvent.change(contactInput, { target: { value: 'Test' } })
      })
      expect(contactInput.value).toBe('Test')

      await act(async () => {
        fireEvent.change(contactInput, { target: { value: '' } })
      })
      expect(contactInput.value).toBe('')
    })
  })

  describe('Conditional Rendering - Add Listing Button', () => {
    test('should show add listing button when not expanded and no existing listing', ({
      render
    }) => {
      render(<CreditMarketForm />)

      expect(
        screen.getByRole('button', { name: /add listing/i })
      ).toBeInTheDocument()
    })

    test('should hide add listing button when form is expanded', async ({
      render
    }) => {
      render(<CreditMarketForm />)

      const addButton = screen.getByRole('button', { name: /add listing/i })

      await act(async () => {
        fireEvent.click(addButton)
      })

      expect(
        screen.queryByRole('button', { name: /add listing/i })
      ).not.toBeInTheDocument()
    })
  })

  describe('Conditional Rendering - Save/Cancel Buttons', () => {
    test('should show save and cancel buttons when in editing mode', async ({
      render
    }) => {
      render(<CreditMarketForm />)

      const addButton = screen.getByRole('button', { name: /add listing/i })

      await act(async () => {
        fireEvent.click(addButton)
      })

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /cancel/i })
      ).toBeInTheDocument()
    })

    test('should hide save and cancel buttons when not editing', ({
      render
    }) => {
      render(<CreditMarketForm />)

      expect(
        screen.queryByRole('button', { name: /save/i })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /cancel/i })
      ).not.toBeInTheDocument()
    })
  })

  describe('Conditional Rendering - No Listing Message', () => {
    test('should show no listing message when form is collapsed and no existing listing', ({
      render
    }) => {
      render(<CreditMarketForm />)

      expect(
        screen.getByText(/Your organization is not currently listed/)
      ).toBeInTheDocument()
    })

    test('should hide no listing message when form is expanded', async ({
      render
    }) => {
      render(<CreditMarketForm />)

      const addButton = screen.getByRole('button', { name: /add listing/i })

      await act(async () => {
        fireEvent.click(addButton)
      })

      expect(
        screen.queryByText(/Your organization is not currently listed/)
      ).not.toBeInTheDocument()
    })
  })

  describe('Form Field States', () => {
    test('should have enabled form fields when editing', async ({ render }) => {
      render(<CreditMarketForm />)

      // Show form first
      const addButton = screen.getByRole('button', { name: /add listing/i })
      await act(async () => {
        fireEvent.click(addButton)
      })

      const contactInput = screen.getByLabelText(/contact person/i)
      const emailInput = screen.getByLabelText(/email/i)
      const phoneInput = screen.getByLabelText(/phone/i)
      const creditsCheckbox = screen.getByLabelText(/credits available/i)

      expect(contactInput).not.toBeDisabled()
      expect(emailInput).not.toBeDisabled()
      expect(phoneInput).not.toBeDisabled()
      expect(creditsCheckbox).not.toBeDisabled()
    })
  })

  describe('Form Collapse Visibility', () => {
    test('should show form when expanded', async ({ render }) => {
      render(<CreditMarketForm />)

      const addButton = screen.getByRole('button', { name: /add listing/i })

      await act(async () => {
        fireEvent.click(addButton)
      })

      expect(screen.getByLabelText(/contact person/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/credits available/i)).toBeInTheDocument()
    })
  })
})
