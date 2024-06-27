import { vi, describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { OtherUsesActions } from '../OtherUsesActions'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter as Router } from 'react-router-dom'

const mockSaveRow = vi.fn()

vi.mock('@/hooks/useOtherUses', () => ({
  useSaveOtherUses: () => ({
    mutate: mockSaveRow
  })
}))

const mockApi = {
  applyTransaction: vi.fn(),
  refreshCells: vi.fn()
}

const WrapperComponent = (props) => {
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <Router>
          <OtherUsesActions {...props} />
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('OtherUsesActions Component Tests', () => {
  afterEach(() => {
    cleanup()
    vi.resetAllMocks()
  })

  const data = {
    id: '001',
    otherUsesId: '123',
    fuelType: 'Diesel',
    fuelCategory: 'Biofuel',
    quantitySupplied: 100,
    modified: false,
    deleted: false
  }

  const node = {
    rowIndex: 1,
    data
  }

  it('renders duplicate and delete buttons correctly', () => {
    render(<WrapperComponent api={mockApi} node={node} data={data} />)
    const duplicateButton = screen.getByTestId('duplicate-button')
    const deleteButton = screen.getByTestId('delete-button')
    expect(duplicateButton).toBeInTheDocument()
    expect(deleteButton).toBeInTheDocument()
  })

  it('calls duplicateRow function on duplicate button click', () => {
    render(<WrapperComponent api={mockApi} node={node} data={data} />)
    const duplicateButton = screen.getByTestId('duplicate-button')
    fireEvent.click(duplicateButton)
    expect(mockApi.applyTransaction).toHaveBeenCalledWith({
      add: [expect.objectContaining({ id: expect.any(String), otherUsesId: null, modified: true })],
      addIndex: node.rowIndex + 1
    })
  })

  it('calls deleteRow function on delete button click', () => {
    render(<WrapperComponent api={mockApi} node={node} data={data} />)
    const deleteButton = screen.getByTestId('delete-button')
    fireEvent.click(deleteButton)
    expect(mockApi.applyTransaction).toHaveBeenCalledWith({ remove: [node.data] })
  })

  it('shows success message when row is duplicated successfully', async () => {
    mockSaveRow.mockImplementation((row, { onSuccess }) => onSuccess())
    const onValidated = vi.fn()
    render(<WrapperComponent api={mockApi} node={node} data={data} onValidated={onValidated} />)
    const duplicateButton = screen.getByTestId('duplicate-button')
    fireEvent.click(duplicateButton)
    await waitFor(() => {
      expect(onValidated).toHaveBeenCalledWith('success', 'Row duplicated successfully.')
    })
  })

  it('shows success message when row is deleted successfully', async () => {
    mockSaveRow.mockImplementation((row, { onSuccess }) => onSuccess())
    const onValidated = vi.fn()
    render(<WrapperComponent api={mockApi} node={node} data={data} onValidated={onValidated} />)
    const deleteButton = screen.getByTestId('delete-button')
    fireEvent.click(deleteButton)
    await waitFor(() => {
      expect(onValidated).toHaveBeenCalledWith('success', 'Row deleted successfully.')
    })
  })

  it('shows error message when row duplication fails', async () => {
    const onValidated = vi.fn()
    mockSaveRow.mockImplementation((_, { onError }) => onError(new Error('Duplication failed')))

    render(<WrapperComponent api={mockApi} node={node} data={data} onValidated={onValidated} />)
    const duplicateButton = screen.getByTestId('duplicate-button')
    fireEvent.click(duplicateButton)
    await waitFor(() => {
      expect(onValidated).toHaveBeenCalledWith('error', 'Error duplicating row: Duplication failed')
    })
  })

  it('shows error message when row deletion fails', async () => {
    const onValidated = vi.fn()
    mockSaveRow.mockImplementation((_, { onError }) => onError(new Error('Deletion failed')))

    render(<WrapperComponent api={mockApi} node={node} data={data} onValidated={onValidated} />)
    const deleteButton = screen.getByTestId('delete-button')
    fireEvent.click(deleteButton)
    await waitFor(() => {
      expect(onValidated).toHaveBeenCalledWith('error', 'Error deleting row: Deletion failed')
    })
  })
})
