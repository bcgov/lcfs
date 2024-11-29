import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotificationTabPanel } from '../NotificationTabPanel'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes'

// Custom render function with all necessary providers
const customRender = (ui, options = {}) => {
  const queryClient = new QueryClient()
  const AllTheProviders = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: AllTheProviders, ...options })
}

describe('NotificationTabPanel Component', () => {
  it('renders children when selected', () => {
    customRender(
      <NotificationTabPanel value={0} index={0}>
        <div>Test Content</div>
      </NotificationTabPanel>
    )
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('does not render children when not selected', () => {
    customRender(
      <NotificationTabPanel value={1} index={0}>
        <div>Test Content</div>
      </NotificationTabPanel>
    )
    expect(screen.queryByText('Test Content')).not.toBeInTheDocument()
  })

  it('has correct ARIA attributes', () => {
    customRender(
      <NotificationTabPanel value={0} index={0}>
        <div>Test Content</div>
      </NotificationTabPanel>
    )
    const panel = screen.getByRole('NotificationTabPanel')
    expect(panel).toHaveAttribute('aria-labelledby', 'full-width-tab-0')
    expect(panel).toHaveAttribute('id', 'full-width-NotificationTabPanel-0')
  })
})
