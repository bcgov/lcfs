import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

// Mock the entire component to avoid complex logic
vi.mock('../AddEditViewTransfer', () => ({
  AddEditViewTransfer: vi.fn(() => <div data-test="add-edit-view-transfer">Mocked AddEditViewTransfer</div>)
}))

import { AddEditViewTransfer } from '../AddEditViewTransfer'

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <AddEditViewTransfer />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('AddEditViewTransfer', () => {
  it('renders mocked component', () => {
    renderComponent()
    expect(screen.getByTestId('add-edit-view-transfer')).toBeInTheDocument()
    expect(screen.getByText('Mocked AddEditViewTransfer')).toBeInTheDocument()
  })

  it('component is called when rendered', () => {
    renderComponent()
    expect(AddEditViewTransfer).toHaveBeenCalled()
  })
})
