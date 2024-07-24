import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes' // Make sure this path is correct
import { AdminTabPanel } from '../AdminMenu/components/AdminTabPanel'

// Custom render function with all necessary providers
const customRender = (ui, options = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const AllTheProviders = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: AllTheProviders, ...options })
}

describe('AdminTabPanel Component', () => {
  it('renders children when selected', () => {
    customRender(
      <AdminTabPanel value={0} index={0}>
        <div>Test Content</div>
      </AdminTabPanel>
    )
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('does not render children when not selected', () => {
    customRender(
      <AdminTabPanel value={1} index={0}>
        <div>Test Content</div>
      </AdminTabPanel>
    )
    expect(screen.queryByText('Test Content')).not.toBeInTheDocument()
  })

  it('has correct ARIA attributes', () => {
    customRender(
      <AdminTabPanel value={0} index={0}>
        <div>Test Content</div>
      </AdminTabPanel>
    )
    const panel = screen.getByRole('AdminTabPanel')
    expect(panel).toHaveAttribute('aria-labelledby', 'full-width-tab-0')
    expect(panel).toHaveAttribute('id', 'full-width-AdminTabPanel-0')
  })
})