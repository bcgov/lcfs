import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import DocumentUploadDialog from '../DocumentUploadDialog'
import { wrapper } from '@/tests/utils/wrapper'

// Mock dependencies
vi.mock('@/components/BCModal', () => ({
  default: ({ open, onClose, data }) => {
    if (!open) return null
    return (
      <div data-test="bc-modal">
        <div data-test="modal-title">{data?.title}</div>
        <div data-test="modal-content">{data?.content}</div>
        <button
          data-test="secondary-button"
          onClick={data?.secondaryButtonAction}
        >
          {data?.secondaryButtonText}
        </button>
        <button data-test="close-button" onClick={onClose}>
          Close
        </button>
      </div>
    )
  }
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => (
    <div data-test="bc-typography" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/Documents/DocumentTable.jsx', () => ({
  default: ({ parentID, parentType }) => (
    <div
      data-test="document-table"
      data-parent-id={parentID}
      data-parent-type={parentType}
    >
      Document Table Component
    </div>
  )
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => {
      const translations = {
        'report:documentLabel':
          'Add file attachments (maximum file size: 50 MB):',
        'report:documents.uploadTitle':
          'Upload supporting documents for your compliance report',
        'report:documents.returnButton': 'Return to compliance report',
        'chargingSite:documents.uploadTitle':
          'Upload supporting documents for charging site',
        'chargingSite:documents.documentLabel':
          'Supporting documents help provide additional context and evidence for this charging site.',
        'chargingSite:documents.returnButton': 'Return to charging site'
      }
      return translations[key] || key
    }
  })
}))

describe('DocumentUploadDialog', () => {
  const defaultProps = {
    open: true,
    close: vi.fn(),
    parentType: 'compliance-report',
    parentID: '123'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // High Priority Tests

  it('should render with initial state and props', () => {
    render(<DocumentUploadDialog {...defaultProps} />, { wrapper })

    expect(screen.getByTestId('bc-modal')).toBeInTheDocument()
    expect(screen.getByTestId('modal-title')).toHaveTextContent(
      'Upload supporting documents for your compliance report'
    )
    expect(screen.getByTestId('bc-typography')).toHaveTextContent(
      'Add file attachments (maximum file size: 50 MB):'
    )
    expect(screen.getByTestId('document-table')).toBeInTheDocument()
  })

  it('should not render when open is false', () => {
    render(<DocumentUploadDialog {...defaultProps} open={false} />, { wrapper })

    expect(screen.queryByTestId('bc-modal')).not.toBeInTheDocument()
  })

  it('should pass correct props to DocumentTable', () => {
    render(<DocumentUploadDialog {...defaultProps} />, { wrapper })

    const documentTable = screen.getByTestId('document-table')
    expect(documentTable).toHaveAttribute('data-parent-id', '123')
    expect(documentTable).toHaveAttribute(
      'data-parent-type',
      'compliance-report'
    )
  })

  it('should handle close action when secondary button is clicked', () => {
    const mockClose = vi.fn()
    render(<DocumentUploadDialog {...defaultProps} close={mockClose} />, {
      wrapper
    })

    const secondaryButton = screen.getByTestId('secondary-button')
    fireEvent.click(secondaryButton)

    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it('should handle close action when modal onClose is triggered', () => {
    const mockClose = vi.fn()
    render(<DocumentUploadDialog {...defaultProps} close={mockClose} />, {
      wrapper
    })

    const closeButton = screen.getByTestId('close-button')
    fireEvent.click(closeButton)

    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it('should display correct modal title', () => {
    render(<DocumentUploadDialog {...defaultProps} />, { wrapper })

    expect(screen.getByTestId('modal-title')).toHaveTextContent(
      'Upload supporting documents for your compliance report'
    )
  })

  it('should display correct secondary button text', () => {
    render(<DocumentUploadDialog {...defaultProps} />, { wrapper })

    expect(screen.getByTestId('secondary-button')).toHaveTextContent(
      'Return to compliance report'
    )
  })

  it('should render document label from translation', () => {
    render(<DocumentUploadDialog {...defaultProps} />, { wrapper })

    expect(screen.getByTestId('bc-typography')).toHaveTextContent(
      'Add file attachments (maximum file size: 50 MB):'
    )
  })

  // Medium Priority Tests

  it('should handle different parentType values', () => {
    render(
      <DocumentUploadDialog {...defaultProps} parentType="fuel-export" />,
      { wrapper }
    )

    const documentTable = screen.getByTestId('document-table')
    expect(documentTable).toHaveAttribute('data-parent-type', 'fuel-export')
  })

  it('should handle different parentID values', () => {
    render(<DocumentUploadDialog {...defaultProps} parentID="456" />, {
      wrapper
    })

    const documentTable = screen.getByTestId('document-table')
    expect(documentTable).toHaveAttribute('data-parent-id', '456')
  })

  it('should maintain component structure and styling', () => {
    render(<DocumentUploadDialog {...defaultProps} />, { wrapper })

    const modalContent = screen.getByTestId('modal-content')
    expect(modalContent).toBeInTheDocument()

    // Verify the Box component is rendered (through the content structure)
    expect(screen.getByTestId('bc-typography')).toBeInTheDocument()
    expect(screen.getByTestId('document-table')).toBeInTheDocument()
  })

  it('should handle multiple open/close cycles correctly', () => {
    const mockClose = vi.fn()
    const { rerender } = render(
      <DocumentUploadDialog {...defaultProps} close={mockClose} open={true} />,
      { wrapper }
    )

    expect(screen.getByTestId('bc-modal')).toBeInTheDocument()

    // Close the dialog
    rerender(
      <DocumentUploadDialog {...defaultProps} close={mockClose} open={false} />
    )
    expect(screen.queryByTestId('bc-modal')).not.toBeInTheDocument()

    // Reopen the dialog
    rerender(
      <DocumentUploadDialog {...defaultProps} close={mockClose} open={true} />
    )
    expect(screen.getByTestId('bc-modal')).toBeInTheDocument()
  })

  it('should handle edge case with empty parentID', () => {
    render(<DocumentUploadDialog {...defaultProps} parentID="" />, { wrapper })

    const documentTable = screen.getByTestId('document-table')
    expect(documentTable).toHaveAttribute('data-parent-id', '')
    expect(documentTable).toBeInTheDocument()
  })

  // Low Priority Tests

  it('should render with consistent component hierarchy', () => {
    render(<DocumentUploadDialog {...defaultProps} />, { wrapper })

    // Verify the component structure is maintained
    const modal = screen.getByTestId('bc-modal')
    const content = screen.getByTestId('modal-content')
    const typography = screen.getByTestId('bc-typography')
    const table = screen.getByTestId('document-table')

    expect(modal).toContainElement(content)
    expect(content).toContainElement(typography)
    expect(content).toContainElement(table)
  })

  it('should handle translation fallback correctly', () => {
    // Mock missing translation
    vi.mocked(vi.doMock)
    vi.doMock('react-i18next', () => ({
      useTranslation: () => ({
        t: (key) => key // Return key if translation missing
      })
    }))

    render(<DocumentUploadDialog {...defaultProps} />, { wrapper })

    // Should render the translation key if translation is missing
    expect(screen.getByTestId('bc-typography')).toBeInTheDocument()
  })

  it('should handle numeric parentID correctly', () => {
    render(<DocumentUploadDialog {...defaultProps} parentID={999} />, {
      wrapper
    })

    const documentTable = screen.getByTestId('document-table')
    expect(documentTable).toHaveAttribute('data-parent-id', '999')
  })

  // Additional Coverage Tests

  it('should handle undefined parentType gracefully', () => {
    render(<DocumentUploadDialog {...defaultProps} parentType={undefined} />, {
      wrapper
    })

    const documentTable = screen.getByTestId('document-table')
    expect(documentTable).toBeInTheDocument()
  })

  it('should handle undefined parentID gracefully', () => {
    render(<DocumentUploadDialog {...defaultProps} parentID={undefined} />, {
      wrapper
    })

    const documentTable = screen.getByTestId('document-table')
    expect(documentTable).toBeInTheDocument()
  })

  it('should maintain proper modal data structure', () => {
    render(<DocumentUploadDialog {...defaultProps} />, { wrapper })

    // Verify all modal data properties are correctly set
    expect(screen.getByTestId('modal-title')).toHaveTextContent(
      'Upload supporting documents for your compliance report'
    )
    expect(screen.getByTestId('secondary-button')).toHaveTextContent(
      'Return to compliance report'
    )
    expect(screen.getByTestId('modal-content')).toBeInTheDocument()
  })

  it('should not call close function on component mount', () => {
    const mockClose = vi.fn()
    render(<DocumentUploadDialog {...defaultProps} close={mockClose} />, {
      wrapper
    })

    // Close function should not be called during initial render
    expect(mockClose).not.toHaveBeenCalled()
  })

  it('should handle close function being undefined', () => {
    // This tests the edge case where close prop might be undefined
    expect(() => {
      render(<DocumentUploadDialog {...defaultProps} close={undefined} />, {
        wrapper
      })
    }).not.toThrow()
  })
})
