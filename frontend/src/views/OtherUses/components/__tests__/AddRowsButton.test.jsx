import { vi, describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AddRowsButton } from '../AddRowsButton'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter as Router } from 'react-router-dom'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

const WrapperComponent = ({ gridApi }) => {
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <Router>
          <AddRowsButton gridApi={gridApi} complianceReportId={1} />
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('AddRowsButton Component Tests', () => {
  afterEach(() => {
    cleanup()
    vi.resetAllMocks()
  })

  it('renders button correctly', () => {
    render(<WrapperComponent gridApi={null} />)
    const button = screen.getByRole('button', { name: /otherUses:addRow/i })
    expect(button).toBeInTheDocument()
  })

  it('opens menu when button is clicked', () => {
    render(<WrapperComponent gridApi={null} />)
    const button = screen.getByRole('button', { name: /otherUses:addRow/i })
    fireEvent.click(button)
    expect(screen.getByText('1 row')).toBeInTheDocument()
    expect(screen.getByText('5 otherUses:rows')).toBeInTheDocument()
    expect(screen.getByText('10 otherUses:rows')).toBeInTheDocument()
  })

  it('calls gridApi.applyTransaction with correct rows on menu item click', () => {
    const mockApplyTransaction = vi.fn()
    const gridApi = { applyTransaction: mockApplyTransaction }

    render(<WrapperComponent gridApi={gridApi} />)
    const button = screen.getByRole('button', { name: /otherUses:addRow/i })
    fireEvent.click(button)

    const menuItem = screen.getByText('1 row')
    fireEvent.click(menuItem)

    expect(mockApplyTransaction).toHaveBeenCalledWith({
      add: [{ id: expect.any(String), complianceReportId: 1 }]
    })
  })
})
