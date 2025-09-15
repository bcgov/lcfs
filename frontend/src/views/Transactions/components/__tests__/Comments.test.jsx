import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Comments } from '../Comments'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

// Mock useFormContext with spies
const mockGetValues = vi.fn()
const mockRegister = vi.fn()

vi.mock('react-hook-form', () => ({
  useFormContext: () => ({
    getValues: mockGetValues,
    register: mockRegister
  })
}))

// Mock useTranslation to return the t function
const mockT = vi.fn((key) => key)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT
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
    mockGetValues.mockReturnValue('')
    mockRegister.mockReturnValue({})
    mockT.mockImplementation((key) => key)
  })

  it('renders without crashing when commentField is provided', () => {
    renderComponent({ commentField, isEditable: true })
    expect(screen.getByText('txn:commentsLabel')).toBeInTheDocument()
    expect(screen.getByText('txn:commentsDescText')).toBeInTheDocument()
    expect(mockT).toHaveBeenCalledWith('txn:commentsLabel')
    expect(mockT).toHaveBeenCalledWith('txn:commentsDescText')
  })

  it('does not render when commentField is falsy', () => {
    const { container } = renderComponent({ commentField: null, isEditable: true })
    expect(container.firstChild).toBeNull()
  })

  it('does not render when commentField is empty string', () => {
    const { container } = renderComponent({ commentField: '', isEditable: true })
    expect(container.firstChild).toBeNull()
  })

  it('toggles collapse visual state', async () => {
    renderComponent({ commentField, isEditable: true })

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
      expect(getComputedStyle(collapseDiv).height).not.toBe('0px')
    })

    // Click to collapse again
    fireEvent.click(toggleButton)
    await waitFor(() => {
      collapseDiv = document.querySelector('.MuiCollapse-root')
      expect(getComputedStyle(collapseDiv).height).toBe('0px')
    })
  })
  it('enables TextField when isEditable is true', () => {
    renderComponent({ commentField, isEditable: true })
    const textField = screen.getByTestId('external-comments')
    expect(textField).toBeEnabled()
  })

  it('disables TextField when isEditable is false', async () => {
    renderComponent({ commentField, isEditable: false })
    
    // Expand the collapse to make the textarea accessible
    const toggleButton = screen.getByRole('button')
    fireEvent.click(toggleButton)
    
    await waitFor(() => {
      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeDisabled()
    })
  })

  it('calls register with commentField', () => {
    renderComponent({ commentField: 'testField', isEditable: true })
    expect(mockRegister).toHaveBeenCalledWith('testField')
  })

  it('shows ExpandMore icon when collapsed', () => {
    renderComponent({ commentField, isEditable: true })
    const expandMoreIcon = document.querySelector('[data-testid="ExpandMoreIcon"]')
    expect(expandMoreIcon).toBeInTheDocument()
  })

  it('shows ExpandLess icon when expanded', async () => {
    renderComponent({ commentField, isEditable: true })
    
    const toggleButton = screen.getByRole('button')
    fireEvent.click(toggleButton)
    
    await waitFor(() => {
      const expandLessIcon = document.querySelector('[data-testid="ExpandLessIcon"]')
      expect(expandLessIcon).toBeInTheDocument()
    })
  })

  it('expands automatically when initial value exists', async () => {
    mockGetValues.mockReturnValue('existing comment')
    
    await act(async () => {
      renderComponent({ commentField: 'testField', isEditable: true })
      await new Promise(resolve => setTimeout(resolve, 10))
    })
    
    await waitFor(() => {
      const expandLessIcon = document.querySelector('[data-testid="ExpandLessIcon"]')
      expect(expandLessIcon).toBeInTheDocument()
    })
  })

  it('does not expand when no initial value exists', async () => {
    mockGetValues.mockReturnValue('')
    
    await act(async () => {
      renderComponent({ commentField: 'testField', isEditable: true })
      await new Promise(resolve => setTimeout(resolve, 10))
    })
    
    const expandMoreIcon = document.querySelector('[data-testid="ExpandMoreIcon"]')
    expect(expandMoreIcon).toBeInTheDocument()
  })

  it('does not expand when initial value is null', async () => {
    mockGetValues.mockReturnValue(null)
    
    await act(async () => {
      renderComponent({ commentField: 'testField', isEditable: true })
      await new Promise(resolve => setTimeout(resolve, 10))
    })
    
    const expandMoreIcon = document.querySelector('[data-testid="ExpandMoreIcon"]')
    expect(expandMoreIcon).toBeInTheDocument()
  })

  it('calls getValues with commentField in useEffect', async () => {
    await act(async () => {
      renderComponent({ commentField: 'testField', isEditable: true })
      await new Promise(resolve => setTimeout(resolve, 10))
    })
    
    expect(mockGetValues).toHaveBeenCalledWith('testField')
  })

  it('toggles expansion state when clicked', async () => {
    renderComponent({ commentField, isEditable: true })
    
    const toggleButton = screen.getByRole('button')
    
    // Initially collapsed
    expect(document.querySelector('[data-testid="ExpandMoreIcon"]')).toBeInTheDocument()
    
    // Click to expand
    fireEvent.click(toggleButton)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="ExpandLessIcon"]')).toBeInTheDocument()
    })
    
    // Click to collapse
    fireEvent.click(toggleButton)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="ExpandMoreIcon"]')).toBeInTheDocument()
    })
  })

  it('renders TextField with correct attributes', async () => {
    renderComponent({ commentField: 'testField', isEditable: true })
    
    // Expand the collapse to make the textarea accessible
    const toggleButton = screen.getByRole('button')
    fireEvent.click(toggleButton)
    
    await waitFor(() => {
      const textarea = screen.getByRole('textbox')
      const textFieldWrapper = screen.getByTestId('external-comments')
      
      expect(textarea).toHaveAttribute('id', 'external-comments')
      expect(textarea).toHaveAttribute('rows', '4')
      expect(textFieldWrapper.getAttribute('class')).toContain('MuiTextField')
    })
  })

  it('renders clickable header with proper styles', () => {
    renderComponent({ commentField, isEditable: true })
    
    const clickableBox = screen.getByText('txn:commentsDescText').closest('div')
    expect(clickableBox).toHaveStyle({ cursor: 'pointer' })
  })

  it('renders LabelBox with correct label prop', () => {
    renderComponent({ commentField: 'testField', isEditable: true })
    expect(screen.getByText('txn:commentsLabel')).toBeInTheDocument()
  })
})
