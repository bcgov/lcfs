import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Comments } from '../Comments'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

// Mock useFormContext to return a register function
vi.mock('react-hook-form', () => ({
  useFormContext: () => ({
    getValues: vi.fn(),
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

const renderComponent = (props) => {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <Comments {...props} isEditable={props.isEditable} />
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
    renderComponent({ commentField, isEditable: true })
    expect(screen.getByText('txn:commentsLabel')).toBeInTheDocument()
    expect(screen.getByText('txn:commentsDescText')).toBeInTheDocument()
  })

  it('toggles collapse when clicking on the header', async () => {
    renderComponent({ commentField, isEditable: true })

    // Find the toggle button
    const toggleButton = screen.getByRole('button')
    expect(toggleButton).toBeInTheDocument()

    // Initially, the collapse should be hidden
    let collapseDiv = document.querySelector('.MuiCollapse-root')
    expect(collapseDiv).toBeInTheDocument()
    expect(getComputedStyle(collapseDiv).height).toBe('0px')

    // Click to expand
    fireEvent.click(toggleButton)
    await waitFor(() => {
      collapseDiv = document.querySelector('.MuiCollapse-root')
      expect(getComputedStyle(collapseDiv).height).not.toBe('0px') // Height should change
    })

    // Click to collapse again
    fireEvent.click(toggleButton)
    await waitFor(() => {
      collapseDiv = document.querySelector('.MuiCollapse-root')
      expect(getComputedStyle(collapseDiv).height).toBe('0px') // Height should reset to 0
    })
  })
  it('enables TextField when isEditable is true', () => {
    renderComponent({ commentField, isEditable: true })
    const textField = screen.getByTestId('external-comments')
    expect(textField).toBeEnabled()
  })
})
