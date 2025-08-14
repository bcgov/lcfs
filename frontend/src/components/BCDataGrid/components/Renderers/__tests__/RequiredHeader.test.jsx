import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RequiredHeader } from '../RequiredHeader'

describe('RequiredHeader', () => {
  const mockProps = {
    column: {
      colDef: {
        headerName: 'Test Header'
      }
    }
  }

  describe('Component Rendering', () => {
    it('renders correctly', () => {
      render(<RequiredHeader {...mockProps} />)
      
      const headerElement = screen.getByRole('columnheader')
      expect(headerElement).toBeInTheDocument()
    })

    it('displays red asterisk', () => {
      render(<RequiredHeader {...mockProps} />)
      
      const asterisk = screen.getByText('*')
      expect(asterisk).toBeInTheDocument()
      expect(asterisk).toHaveStyle({ color: 'rgb(255, 0, 0)' })
    })

    it('displays header name from props', () => {
      render(<RequiredHeader {...mockProps} />)
      
      const headerText = screen.getByText('Test Header')
      expect(headerText).toBeInTheDocument()
    })

    it('sets correct role attribute', () => {
      render(<RequiredHeader {...mockProps} />)
      
      const headerElement = screen.getByRole('columnheader')
      expect(headerElement).toHaveAttribute('role', 'columnheader')
    })

    it('sets correct aria-label attribute', () => {
      render(<RequiredHeader {...mockProps} />)
      
      const headerElement = screen.getByRole('columnheader')
      expect(headerElement).toHaveAttribute('aria-label', 'Test Header')
    })

    it('applies correct CSS class to header text', () => {
      render(<RequiredHeader {...mockProps} />)
      
      const headerText = screen.getByText('Test Header')
      expect(headerText).toHaveClass('ag-header-cell-text')
    })

    it('handles different header names correctly', () => {
      const customProps = {
        column: {
          colDef: {
            headerName: 'Custom Column Name'
          }
        }
      }
      
      render(<RequiredHeader {...customProps} />)
      
      const headerText = screen.getByText('Custom Column Name')
      const headerElement = screen.getByRole('columnheader')
      
      expect(headerText).toBeInTheDocument()
      expect(headerElement).toHaveAttribute('aria-label', 'Custom Column Name')
    })
  })
})