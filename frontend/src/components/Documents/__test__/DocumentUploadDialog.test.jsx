import { screen, fireEvent } from '@testing-library/react'
import { vi, describe, expect, beforeEach } from 'vitest'
import DocumentUploadDialog from '../DocumentUploadDialog'
import { test } from '@/tests/utils/fixtures'

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

  test('should render with initial state and props', ({
    render,
    theme,
    router
  }) => {
    render(<DocumentUploadDialog {...defaultProps} />, [theme, router])

    expect(screen.getByTestId('bc-modal')).toBeInTheDocument()
    expect(screen.getByTestId('modal-title')).toHaveTextContent(
      'Upload supporting documents for your compliance report'
    )
    expect(screen.getByTestId('bc-typography')).toHaveTextContent(
      'Add file attachments (maximum file size: 50 MB):'
    )
    expect(screen.getByTestId('document-table')).toBeInTheDocument()
  })

  test('should not render when open is false', ({ render, theme, router }) => {
    render(<DocumentUploadDialog {...defaultProps} open={false} />, [
      theme,
      router
    ])

    expect(screen.queryByTestId('bc-modal')).not.toBeInTheDocument()
  })

  test('should pass correct props to DocumentTable', ({
    render,
    theme,
    router
  }) => {
    render(<DocumentUploadDialog {...defaultProps} />, [theme, router])

    const documentTable = screen.getByTestId('document-table')
    expect(documentTable).toHaveAttribute('data-parent-id', '123')
    expect(documentTable).toHaveAttribute(
      'data-parent-type',
      'compliance-report'
    )
  })

  test('should handle close action when secondary button is clicked', ({
    render,
    theme,
    router
  }) => {
    const mockClose = vi.fn()
    render(<DocumentUploadDialog {...defaultProps} close={mockClose} />, [
      theme,
      router
    ])

    const secondaryButton = screen.getByTestId('secondary-button')
    fireEvent.click(secondaryButton)

    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  test('should handle close action when modal onClose is triggered', ({
    render,
    theme,
    router
  }) => {
    const mockClose = vi.fn()
    render(<DocumentUploadDialog {...defaultProps} close={mockClose} />, [
      theme,
      router
    ])

    const closeButton = screen.getByTestId('close-button')
    fireEvent.click(closeButton)

    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  test('should display correct modal title', ({ render, theme, router }) => {
    render(<DocumentUploadDialog {...defaultProps} />, [theme, router])

    expect(screen.getByTestId('modal-title')).toHaveTextContent(
      'Upload supporting documents for your compliance report'
    )
  })

  test('should display correct secondary button text', ({
    render,
    theme,
    router
  }) => {
    render(<DocumentUploadDialog {...defaultProps} />, [theme, router])

    expect(screen.getByTestId('secondary-button')).toHaveTextContent(
      'Return to compliance report'
    )
  })

  test('should render document label from translation', ({
    render,
    theme,
    router
  }) => {
    render(<DocumentUploadDialog {...defaultProps} />, [theme, router])

    expect(screen.getByTestId('bc-typography')).toHaveTextContent(
      'Add file attachments (maximum file size: 50 MB):'
    )
  })

  // Medium Priority Tests

  test('should handle different parentType values', ({
    render,
    theme,
    router
  }) => {
    render(
      <DocumentUploadDialog {...defaultProps} parentType="fuel-export" />,
      [theme, router]
    )

    const documentTable = screen.getByTestId('document-table')
    expect(documentTable).toHaveAttribute('data-parent-type', 'fuel-export')
  })

  test('should handle different parentID values', ({
    render,
    theme,
    router
  }) => {
    render(<DocumentUploadDialog {...defaultProps} parentID="456" />, [
      theme,
      router
    ])

    const documentTable = screen.getByTestId('document-table')
    expect(documentTable).toHaveAttribute('data-parent-id', '456')
  })

  test('should maintain component structure and styling', ({
    render,
    theme,
    router
  }) => {
    render(<DocumentUploadDialog {...defaultProps} />, [theme, router])

    const modalContent = screen.getByTestId('modal-content')
    expect(modalContent).toBeInTheDocument()

    // Verify the Box component is rendered (through the content structure)
    expect(screen.getByTestId('bc-typography')).toBeInTheDocument()
    expect(screen.getByTestId('document-table')).toBeInTheDocument()
  })

  test('should handle multiple open/close cycles correctly', ({
    render,
    theme,
    router
  }) => {
    const mockClose = vi.fn()
    const { rerender } = render(
      <DocumentUploadDialog {...defaultProps} close={mockClose} open={true} />,
      [theme, router]
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

  test('should handle edge case with empty parentID', ({
    render,
    theme,
    router
  }) => {
    render(<DocumentUploadDialog {...defaultProps} parentID="" />, [
      theme,
      router
    ])

    const documentTable = screen.getByTestId('document-table')
    expect(documentTable).toHaveAttribute('data-parent-id', '')
    expect(documentTable).toBeInTheDocument()
  })

  // Low Priority Tests

  test('should render with consistent component hierarchy', ({
    render,
    theme,
    router
  }) => {
    render(<DocumentUploadDialog {...defaultProps} />, [theme, router])

    // Verify the component structure is maintained
    const modal = screen.getByTestId('bc-modal')
    const content = screen.getByTestId('modal-content')
    const typography = screen.getByTestId('bc-typography')
    const table = screen.getByTestId('document-table')

    expect(modal).toContainElement(content)
    expect(content).toContainElement(typography)
    expect(content).toContainElement(table)
  })

  test('should handle translation fallback correctly', ({
    render,
    theme,
    router
  }) => {
    // Mock missing translation
    vi.mocked(vi.doMock)
    vi.doMock('react-i18next', () => ({
      useTranslation: () => ({
        t: (key) => key // Return key if translation missing
      })
    }))

    render(<DocumentUploadDialog {...defaultProps} />, [theme, router])

    // Should render the translation key if translation is missing
    expect(screen.getByTestId('bc-typography')).toBeInTheDocument()
  })

  test('should handle numeric parentID correctly', ({
    render,
    theme,
    router
  }) => {
    render(<DocumentUploadDialog {...defaultProps} parentID={999} />, [
      theme,
      router
    ])

    const documentTable = screen.getByTestId('document-table')
    expect(documentTable).toHaveAttribute('data-parent-id', '999')
  })

  // Additional Coverage Tests

  test('should handle undefined parentType gracefully', ({
    render,
    theme,
    router
  }) => {
    render(<DocumentUploadDialog {...defaultProps} parentType={undefined} />, [
      theme,
      router
    ])

    const documentTable = screen.getByTestId('document-table')
    expect(documentTable).toBeInTheDocument()
  })

  test('should handle undefined parentID gracefully', ({
    render,
    theme,
    router
  }) => {
    render(<DocumentUploadDialog {...defaultProps} parentID={undefined} />, [
      theme,
      router
    ])

    const documentTable = screen.getByTestId('document-table')
    expect(documentTable).toBeInTheDocument()
  })

  test('should maintain proper modal data structure', ({
    render,
    theme,
    router
  }) => {
    render(<DocumentUploadDialog {...defaultProps} />, [theme, router])

    // Verify all modal data properties are correctly set
    expect(screen.getByTestId('modal-title')).toHaveTextContent(
      'Upload supporting documents for your compliance report'
    )
    expect(screen.getByTestId('secondary-button')).toHaveTextContent(
      'Return to compliance report'
    )
    expect(screen.getByTestId('modal-content')).toBeInTheDocument()
  })

  test('should not call close function on component mount', ({
    render,
    theme,
    router
  }) => {
    const mockClose = vi.fn()
    render(<DocumentUploadDialog {...defaultProps} close={mockClose} />, [
      theme,
      router
    ])

    // Close function should not be called during initial render
    expect(mockClose).not.toHaveBeenCalled()
  })

  test('should handle close function being undefined', ({
    render,
    theme,
    router
  }) => {
    // This tests the edge case where close prop might be undefined
    expect(() => {
      render(<DocumentUploadDialog {...defaultProps} close={undefined} />, [
        theme,
        router
      ])
    }).not.toThrow()
  })
})
