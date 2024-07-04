import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes' // Adjust this import path as needed
import SummaryTable from '../SummaryTable'

// Mock MUI components
vi.mock('@mui/material', () => ({
  Table: ({ children }) => <table>{children}</table>,
  TableBody: ({ children }) => <tbody>{children}</tbody>,
  TableCell: ({ children }) => <td>{children}</td>,
  TableContainer: ({ children }) => <div>{children}</div>,
  TableHead: ({ children }) => <thead>{children}</thead>,
  TableRow: ({ children }) => <tr>{children}</tr>,
  Paper: ({ children }) => <div>{children}</div>,
}))

// Custom render function with providers
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

describe('SummaryTable', () => {
  const mockColumns = [
    { id: 'name', label: 'Name', align: 'left' },
    { id: 'value', label: 'Value', align: 'right' },
  ]

  const mockData = [
    { line: 1, name: 'Item 1', value: '100' },
    { line: 2, name: 'Item 2', value: '200' },
  ]

  it('renders correct column labels', () => {
    customRender(<SummaryTable title="Test Table" columns={mockColumns} data={mockData} />)
    mockColumns.forEach(column => {
      expect(screen.getByText(column.label)).toBeInTheDocument()
    })
  })

  it('renders correct number of data rows', () => {
    customRender(<SummaryTable title="Test Table" columns={mockColumns} data={mockData} />)
    const dataRows = screen.getAllByRole('row').slice(1) // Exclude header row
    expect(dataRows).toHaveLength(mockData.length)
  })

  it('renders correct data in cells', () => {
    customRender(<SummaryTable title="Test Table" columns={mockColumns} data={mockData} />)
    mockData.forEach(row => {
      expect(screen.getByText(row.name)).toBeInTheDocument()
      expect(screen.getByText(row.value)).toBeInTheDocument()
    })
  })
})
