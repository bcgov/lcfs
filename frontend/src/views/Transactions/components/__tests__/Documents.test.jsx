import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TransactionDocuments from '../Documents'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

// Mock useTranslation to return the t function
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock only the DocumentTable component to avoid loading issues
vi.mock('@/components/Documents/DocumentTable.jsx', () => ({
  default: ({ parentID, parentType }) => (
    <div data-testid="document-table" data-parent-id={parentID} data-parent-type={parentType}>
      Document Table
    </div>
  )
}))

const renderComponent = (props = {}) => {
  const queryClient = new QueryClient()
  const defaultProps = {
    parentType: 'transaction',
    parentID: 123,
    ...props
  }
  
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <TransactionDocuments {...defaultProps} />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('TransactionDocuments Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    renderComponent()
    expect(screen.getByText('txn:attachmentsOptional')).toBeInTheDocument()
    expect(screen.getByText('txn:attachmentsTitle')).toBeInTheDocument()
  })

  it('renders with correct translation keys', () => {
    renderComponent()
    expect(screen.getByText('txn:attachmentsOptional')).toBeInTheDocument()
    expect(screen.getByText('txn:attachmentsTitle')).toBeInTheDocument()
  })

  it('renders with collapsed state initially', () => {
    renderComponent()
    const collapseDiv = document.querySelector('.MuiCollapse-root')
    expect(collapseDiv).toBeInTheDocument()
    expect(getComputedStyle(collapseDiv).height).toBe('0px')
  })

  it('renders ExpandMore icon when collapsed', () => {
    renderComponent()
    const expandMoreIcon = document.querySelector('[data-testid="ExpandMoreIcon"]')
    const expandLessIcon = document.querySelector('[data-testid="ExpandLessIcon"]')
    
    expect(expandMoreIcon).toBeInTheDocument()
    expect(expandLessIcon).not.toBeInTheDocument()
  })

  it('toggles to expanded state when clicked', async () => {
    renderComponent()
    
    const clickableBox = screen.getByText('txn:attachmentsTitle').closest('div')
    
    fireEvent.click(clickableBox)
    
    await waitFor(() => {
      const expandLessIcon = document.querySelector('[data-testid="ExpandLessIcon"]')
      const expandMoreIcon = document.querySelector('[data-testid="ExpandMoreIcon"]')
      
      expect(expandLessIcon).toBeInTheDocument()
      expect(expandMoreIcon).not.toBeInTheDocument()
    })
  })

  it('expands collapse section when clicked', async () => {
    renderComponent()
    
    const clickableBox = screen.getByText('txn:attachmentsTitle').closest('div')
    fireEvent.click(clickableBox)
    
    await waitFor(() => {
      const collapseDiv = document.querySelector('.MuiCollapse-root')
      expect(getComputedStyle(collapseDiv).height).not.toBe('0px')
    })
  })

  it('collapses back when clicked again', async () => {
    renderComponent()
    
    const clickableBox = screen.getByText('txn:attachmentsTitle').closest('div')
    
    // First click to expand
    fireEvent.click(clickableBox)
    await waitFor(() => {
      const collapseDiv = document.querySelector('.MuiCollapse-root')
      expect(getComputedStyle(collapseDiv).height).not.toBe('0px')
    })
    
    // Second click to collapse
    fireEvent.click(clickableBox)
    await waitFor(() => {
      const collapseDiv = document.querySelector('.MuiCollapse-root')
      expect(getComputedStyle(collapseDiv).height).toBe('0px')
    })
  })

  it('passes correct props to DocumentTable', () => {
    const parentType = 'report'
    const parentID = 456
    
    renderComponent({ parentType, parentID })
    
    const documentTable = document.querySelector('[data-testid="document-table"]')
    expect(documentTable).toBeInTheDocument()
    expect(documentTable).toHaveAttribute('data-parent-type', parentType)
    expect(documentTable).toHaveAttribute('data-parent-id', parentID.toString())
  })

  it('passes different props to DocumentTable', () => {
    const parentType = 'transfer'  
    const parentID = 789
    
    renderComponent({ parentType, parentID })
    
    const documentTable = document.querySelector('[data-testid="document-table"]')
    expect(documentTable).toBeInTheDocument()
    expect(documentTable).toHaveAttribute('data-parent-type', parentType)
    expect(documentTable).toHaveAttribute('data-parent-id', parentID.toString())
  })
})