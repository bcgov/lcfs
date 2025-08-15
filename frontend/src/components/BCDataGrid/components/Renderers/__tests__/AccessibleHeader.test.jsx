import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AccessibleHeader } from '../AccessibleHeader'

describe('AccessibleHeader', () => {
  const mockProps = {
    column: {
      colDef: {
        headerName: 'Test Header Name'
      }
    }
  }

  it('renders successfully with valid props', () => {
    render(<AccessibleHeader {...mockProps} />)
    expect(screen.getByText('Test Header Name')).toBeInTheDocument()
  })

  it('renders correct accessibility attributes', () => {
    render(<AccessibleHeader {...mockProps} />)
    const headerDiv = screen.getByRole('columnheader')
    
    expect(headerDiv).toHaveAttribute('role', 'columnheader')
    expect(headerDiv).toHaveAttribute('aria-label', 'Test Header Name')
    expect(headerDiv).toHaveAttribute('data-ref', 'columnWrapper')
  })

  it('renders content with correct CSS class', () => {
    render(<AccessibleHeader {...mockProps} />)
    const spanElement = screen.getByText('Test Header Name')
    
    expect(spanElement).toHaveClass('ag-header-cell-text')
    expect(spanElement.tagName).toBe('SPAN')
  })

  it('uses headerName from props structure correctly', () => {
    const customProps = {
      column: {
        colDef: {
          headerName: 'Custom Column Title'
        }
      }
    }
    
    render(<AccessibleHeader {...customProps} />)
    
    expect(screen.getByText('Custom Column Title')).toBeInTheDocument()
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-label', 'Custom Column Title')
  })

  it('handles empty string headerName', () => {
    const emptyProps = {
      column: {
        colDef: {
          headerName: ''
        }
      }
    }
    
    render(<AccessibleHeader {...emptyProps} />)
    const headerDiv = screen.getByRole('columnheader')
    
    expect(headerDiv).toHaveAttribute('aria-label', '')
    expect(headerDiv.querySelector('.ag-header-cell-text')).toBeInTheDocument()
  })
})