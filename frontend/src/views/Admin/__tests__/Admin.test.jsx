import { vi, describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter as Router } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import theme from '@/themes'
import { Admin } from '../Admin'

// Mock the useNavigate hook
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

// Custom render function with all necessary providers
const customRender = (ui, options = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  const AllTheProviders = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <Router>{children}</Router>
      </ThemeProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: AllTheProviders, ...options })
}

describe('Admin Component', () => {
  it('renders correctly', () => {
    customRender(<Admin />)
    const button = screen.getByRole('button', { name: /Admin Settings/i })
    expect(button).toBeInTheDocument()
  })

  it('navigates to admin users page when clicked', () => {
    customRender(<Admin />)
    const button = screen.getByRole('button', { name: /Admin Settings/i })
    fireEvent.click(button)
    expect(mockNavigate).toHaveBeenCalledWith('/admin/users')
  })
})
