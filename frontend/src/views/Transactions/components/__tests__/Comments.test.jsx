import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Comments } from '../Comments'
import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

// Mock useFormContext to return a register function
vi.mock('react-hook-form', () => ({
  useFormContext: () => ({
    register: vi.fn()
  })
}))

// Mock useTranslation to return the t function
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

const commentField = 'comment'
const isEditable = true

const renderComponent = (props) => {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <Comments {...props} />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('Comments Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    renderComponent({ commentField, isEditable })
    expect(screen.getByText('txn:commentsLabel')).toBeInTheDocument()
    expect(screen.getByText('txn:commentsDescText')).toBeInTheDocument()
  })

  it('toggles collapse when clicking on the header', () => {
    renderComponent({ commentField, isEditable })

    const header = screen.getByText('txn:commentsDescText').closest('div')
    expect(header).toBeInTheDocument()

    // Find the button by its role
    const toggleButton = screen.getByRole('button')
    expect(toggleButton).toBeInTheDocument()

    // Click to collapse
    fireEvent.click(toggleButton)
    const collapseDiv = document.querySelector('.MuiCollapse-root')
    expect(collapseDiv).toBeInTheDocument()

    setTimeout(() => {
      expect(getComputedStyle(collapseDiv).height).toBe('0px')
    }, 300) // Assuming 300ms is the transition duration

    // Click to expand
    fireEvent.click(toggleButton)
    setTimeout(() => {
      expect(getComputedStyle(collapseDiv).height).not.toBe('0px')
    }, 300) // Assuming 300ms is the transition duration
  })

  it('disables TextField when isEditable is false', () => {
    renderComponent({ commentField, isEditable: false })
    const textField = screen.getByRole('textbox')
    expect(textField).toBeDisabled()
  })

  it('enables TextField when isEditable is true', () => {
    renderComponent({ commentField, isEditable: true })
    const textField = screen.getByRole('textbox')
    expect(textField).toBeEnabled()
  })
})
