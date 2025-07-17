import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import DataGridLoading from '../DataGridLoading'

describe('DataGridLoading', () => {
  describe('Basic Rendering', () => {
    it('renders with default loading message', () => {
      render(<DataGridLoading loadingMessage="Loading..." />)
      
      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(screen.getByLabelText('Loading...')).toBeInTheDocument()
    })

    it('renders without loading message', () => {
      render(<DataGridLoading />)
      
      const container = screen.getByText('', { selector: '.ag-overlay-loading-center-box' })
      expect(container).toBeInTheDocument()
      expect(container).toHaveClass('ag-overlay-loading-center-box')
    })

    it('renders with custom loading message', () => {
      const customMessage = 'Fetching your data...'
      render(<DataGridLoading loadingMessage={customMessage} />)
      
      expect(screen.getByText(customMessage)).toBeInTheDocument()
      expect(screen.getByLabelText(customMessage)).toBeInTheDocument()
    })
  })

  describe('DOM Structure and CSS Classes', () => {
    it('has correct CSS classes for ag-grid overlay', () => {
      render(<DataGridLoading loadingMessage="Loading..." />)
      
      const centerContainer = screen.getByLabelText('Loading...').parentElement
      expect(centerContainer).toHaveClass('ag-overlay-loading-center')
      expect(centerContainer).toHaveStyle({ position: 'fixed' })
    })

    it('contains loading center box with correct class', () => {
      render(<DataGridLoading loadingMessage="Loading..." />)
      
      const centerBox = screen.getByLabelText('Loading...')
      expect(centerBox).toHaveClass('ag-overlay-loading-center-box')
    })

    it('contains loading text with correct class', () => {
      render(<DataGridLoading loadingMessage="Loading..." />)
      
      const textElement = screen.getByText('Loading...')
      expect(textElement).toHaveClass('ag-overlay-loading-center-text')
    })
  })

  describe('Accessibility', () => {
    it('provides proper aria-label for loading state', () => {
      const loadingMessage = 'Loading data table'
      render(<DataGridLoading loadingMessage={loadingMessage} />)
      
      const loadingBox = screen.getByLabelText(loadingMessage)
      expect(loadingBox).toBeInTheDocument()
      expect(loadingBox).toHaveAttribute('aria-label', loadingMessage)
    })

    it('handles empty aria-label gracefully', () => {
      render(<DataGridLoading />)
      
      const loadingBox = screen.getByText('', { selector: '.ag-overlay-loading-center-box' })
      expect(loadingBox).not.toHaveAttribute('aria-label')
    })

    it('provides accessible loading state for screen readers', () => {
      render(<DataGridLoading loadingMessage="Loading compliance reports" />)
      
      expect(screen.getByText('Loading compliance reports')).toBeInTheDocument()
      expect(screen.getByLabelText('Loading compliance reports')).toBeInTheDocument()
    })
  })

  describe('Different Grid Scenarios', () => {
    it('handles long loading messages', () => {
      const longMessage = 'Loading a very long compliance report with multiple fuel types and complex calculations...'
      render(<DataGridLoading loadingMessage={longMessage} />)
      
      expect(screen.getByText(longMessage)).toBeInTheDocument()
      expect(screen.getByLabelText(longMessage)).toBeInTheDocument()
    })

    it('handles special characters in loading message', () => {
      const specialMessage = 'Loading... 50% (1/2) - Please wait!'
      render(<DataGridLoading loadingMessage={specialMessage} />)
      
      expect(screen.getByText(specialMessage)).toBeInTheDocument()
      expect(screen.getByLabelText(specialMessage)).toBeInTheDocument()
    })

    it('handles null loading message gracefully', () => {
      render(<DataGridLoading loadingMessage={null} />)
      
      const container = screen.getByText('', { selector: '.ag-overlay-loading-center-box' })
      expect(container).toBeInTheDocument()
      expect(container).toHaveClass('ag-overlay-loading-center-box')
    })

    it('handles undefined loading message gracefully', () => {
      render(<DataGridLoading loadingMessage={undefined} />)
      
      const container = screen.getByText('', { selector: '.ag-overlay-loading-center-box' })
      expect(container).toBeInTheDocument()
      expect(container).toHaveClass('ag-overlay-loading-center-box')
    })
  })

  describe('Animation and Performance', () => {
    it('maintains consistent DOM structure for animations', () => {
      const { rerender } = render(<DataGridLoading loadingMessage="Loading..." />)
      
      const initialStructure = screen.getByLabelText('Loading...').parentElement
      expect(initialStructure).toHaveClass('ag-overlay-loading-center')
      
      rerender(<DataGridLoading loadingMessage="Still loading..." />)
      
      const newStructure = screen.getByLabelText('Still loading...').parentElement
      expect(newStructure).toHaveClass('ag-overlay-loading-center')
    })

    it('supports ag-grid overlay positioning', () => {
      render(<DataGridLoading loadingMessage="Loading..." />)
      
      const overlay = screen.getByLabelText('Loading...').parentElement
      expect(overlay).toHaveStyle('position: fixed')
    })
  })

  describe('Integration with ag-Grid', () => {
    it('follows ag-grid loading overlay conventions', () => {
      render(<DataGridLoading loadingMessage="Loading data..." />)
      
      expect(screen.getByLabelText('Loading data...').parentElement).toHaveClass('ag-overlay-loading-center')
      expect(screen.getByLabelText('Loading data...')).toHaveClass('ag-overlay-loading-center-box')
      expect(screen.getByText('Loading data...')).toHaveClass('ag-overlay-loading-center-text')
    })

    it('provides proper structure for ag-grid overlay system', () => {
      render(<DataGridLoading loadingMessage="Loading..." />)
      
      const centerDiv = screen.getByLabelText('Loading...').parentElement
      const centerBox = screen.getByLabelText('Loading...')
      const textDiv = screen.getByText('Loading...')
      
      expect(centerDiv?.children).toHaveLength(2)
      expect(centerDiv?.children[0]).toBe(centerBox)
      expect(centerDiv?.children[1]).toBe(textDiv)
    })
  })
})
