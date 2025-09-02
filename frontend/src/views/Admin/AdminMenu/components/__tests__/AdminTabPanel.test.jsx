import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes/index.js'
import { AdminTabPanel } from '../AdminTabPanel.jsx'

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
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: AllTheProviders, ...options })
}

describe('AdminTabPanel Component', () => {
  it('renders children when active (value === index)', () => {
    customRender(
      <AdminTabPanel value={0} index={0}>
        <div>Active Content</div>
      </AdminTabPanel>
    )
    expect(screen.getByText('Active Content')).toBeInTheDocument()
  })

  it('does not render children when inactive (value !== index)', () => {
    customRender(
      <AdminTabPanel value={1} index={0}>
        <div>Inactive Content</div>
      </AdminTabPanel>
    )
    expect(screen.queryByText('Inactive Content')).not.toBeInTheDocument()
  })

  it('sets hidden attribute correctly for active tab', () => {
    customRender(
      <AdminTabPanel value={0} index={0}>
        <div>Content</div>
      </AdminTabPanel>
    )
    const panel = screen.getByRole('AdminTabPanel')
    expect(panel).not.toHaveAttribute('hidden')
  })

  it('sets hidden attribute correctly for inactive tab', () => {
    customRender(
      <AdminTabPanel value={1} index={0}>
        <div>Content</div>
      </AdminTabPanel>
    )
    const panel = screen.getByRole('AdminTabPanel', { hidden: true })
    expect(panel).toHaveAttribute('hidden')
  })

  it('generates correct ID and ARIA attributes', () => {
    customRender(
      <AdminTabPanel value={2} index={2}>
        <div>Test Content</div>
      </AdminTabPanel>
    )
    const panel = screen.getByRole('AdminTabPanel')
    expect(panel).toHaveAttribute('id', 'full-width-AdminTabPanel-2')
    expect(panel).toHaveAttribute('aria-labelledby', 'full-width-tab-2')
  })

  it('passes through additional props', () => {
    customRender(
      <AdminTabPanel 
        value={0} 
        index={0}
        data-testid="custom-panel"
        className="custom-class"
      >
        <div>Content</div>
      </AdminTabPanel>
    )
    const panel = screen.getByRole('AdminTabPanel')
    expect(panel).toHaveAttribute('data-testid', 'custom-panel')
    expect(panel).toHaveClass('custom-class')
  })

  it('handles null children gracefully', () => {
    customRender(
      <AdminTabPanel value={0} index={0}>
        {null}
      </AdminTabPanel>
    )
    const panel = screen.getByRole('AdminTabPanel')
    expect(panel).toBeInTheDocument()
    expect(panel).not.toHaveAttribute('hidden')
  })

  it('handles undefined children gracefully', () => {
    customRender(
      <AdminTabPanel value={0} index={0}>
        {undefined}
      </AdminTabPanel>
    )
    const panel = screen.getByRole('AdminTabPanel')
    expect(panel).toBeInTheDocument()
  })
})
