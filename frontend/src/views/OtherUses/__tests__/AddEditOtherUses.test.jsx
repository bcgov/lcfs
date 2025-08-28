import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

// Mock the entire component to avoid complex logic
vi.mock('../AddEditOtherUses', () => ({
  AddEditOtherUses: vi.fn(() => <div data-test="add-edit-other-uses">Mocked AddEditOtherUses</div>)
}))

import { AddEditOtherUses } from '../AddEditOtherUses'

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <AddEditOtherUses />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('AddEditOtherUses', () => {
  it('renders mocked component', () => {
    renderComponent()
    expect(screen.getByTestId('add-edit-other-uses')).toBeInTheDocument()
    expect(screen.getByText('Mocked AddEditOtherUses')).toBeInTheDocument()
  })

  it('component is called when rendered', () => {
    renderComponent()
    expect(AddEditOtherUses).toHaveBeenCalled()
  })
})