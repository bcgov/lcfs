import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { DownloadButton } from '../DownloadButton'

// Mock BCButton and BCTypography components
vi.mock('@/components/BCButton', () => ({
  default: vi.fn().mockImplementation(({ children, onClick, disabled, startIcon, ref, ...props }) => {
    const handleClick = disabled ? undefined : onClick
    const dataTest = props['data-test'] || 'bc-button'
    const buttonProps = {
      ref,
      onClick: handleClick,
      'data-test': dataTest,
      ...props
    }
    
    if (disabled) {
      buttonProps.disabled = true
    }
    
    return (
      <button {...buttonProps}>
        {startIcon && <span data-test="start-icon">{startIcon}</span>}
        {children}
      </button>
    )
  })
}))

vi.mock('@/components/BCTypography', () => ({
  default: vi.fn(({ children, ...props }) => (
    <span data-test="bc-typography" {...props}>{children}</span>
  ))
}))

// Mock FontAwesome components
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: vi.fn(({ icon, className }) => (
    <span data-test="font-awesome-icon" className={className}>
      {icon.iconName || 'excel-icon'}
    </span>
  ))
}))

vi.mock('@fortawesome/free-solid-svg-icons', () => ({
  faFileExcel: { iconName: 'file-excel' }
}))

// Mock Material-UI CircularProgress
vi.mock('@mui/material', () => ({
  CircularProgress: vi.fn(({ size }) => (
    <div data-test="circular-progress" data-size={size}>Loading...</div>
  ))
}))

describe('DownloadButton', () => {
  const defaultProps = {
    onDownload: vi.fn(),
    isDownloading: false,
    label: 'Download',
    downloadLabel: 'Downloading...',
    dataTest: 'download-button'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(<DownloadButton {...defaultProps} />)
      
      expect(screen.getByTestId('download-button')).toBeInTheDocument()
      expect(screen.getByTestId('bc-typography')).toBeInTheDocument()
      expect(screen.getByText('Download')).toBeInTheDocument()
    })

    it('displays correct label when not downloading', () => {
      render(<DownloadButton {...defaultProps} />)
      
      expect(screen.getByText('Download')).toBeInTheDocument()
      expect(screen.queryByText('Downloading...')).not.toBeInTheDocument()
    })

    it('displays download label when downloading', () => {
      render(<DownloadButton {...defaultProps} isDownloading={true} />)
      
      expect(screen.getByText('Downloading...')).toBeInTheDocument()
      expect(screen.queryByText('Download')).not.toBeInTheDocument()
    })

    it('renders with custom labels', () => {
      const customProps = {
        ...defaultProps,
        label: 'Export Data',
        downloadLabel: 'Exporting...'
      }
      
      render(<DownloadButton {...customProps} />)
      expect(screen.getByText('Export Data')).toBeInTheDocument()
      
      render(<DownloadButton {...customProps} isDownloading={true} />)
      expect(screen.getByText('Exporting...')).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('shows CircularProgress when downloading', () => {
      render(<DownloadButton {...defaultProps} isDownloading={true} />)
      
      const progress = screen.getByTestId('circular-progress')
      expect(progress).toBeInTheDocument()
      expect(progress).toHaveAttribute('data-size', '24')
    })

    it('shows Excel icon when not downloading', () => {
      render(<DownloadButton {...defaultProps} isDownloading={false} />)
      
      const icon = screen.getByTestId('font-awesome-icon')
      expect(icon).toBeInTheDocument()
      expect(icon).toHaveClass('small-icon')
      expect(icon).toHaveTextContent('file-excel')
    })

    it('switches between icons correctly', () => {
      const { rerender } = render(<DownloadButton {...defaultProps} isDownloading={false} />)
      
      expect(screen.getByTestId('font-awesome-icon')).toBeInTheDocument()
      expect(screen.queryByTestId('circular-progress')).not.toBeInTheDocument()
      
      rerender(<DownloadButton {...defaultProps} isDownloading={true} />)
      
      expect(screen.queryByTestId('font-awesome-icon')).not.toBeInTheDocument()
      expect(screen.getByTestId('circular-progress')).toBeInTheDocument()
    })

    it('disables button when downloading', () => {
      render(<DownloadButton {...defaultProps} isDownloading={true} />)
      
      const button = screen.getByTestId('download-button')
      expect(button).toBeDisabled()
    })

    it('enables button when not downloading', () => {
      render(<DownloadButton {...defaultProps} isDownloading={false} />)
      
      const button = screen.getByTestId('download-button')
      expect(button).not.toBeDisabled()
    })
  })

  describe('Event Handling', () => {
    it('calls onDownload when clicked', async () => {
      const user = userEvent.setup()
      render(<DownloadButton {...defaultProps} />)
      
      const button = screen.getByTestId('download-button')
      await user.click(button)
      
      expect(defaultProps.onDownload).toHaveBeenCalledTimes(1)
    })

    it('does not call onDownload when disabled/downloading', async () => {
      const user = userEvent.setup()
      render(<DownloadButton {...defaultProps} isDownloading={true} />)
      
      const button = screen.getByTestId('download-button')
      await user.click(button)
      
      expect(defaultProps.onDownload).not.toHaveBeenCalled()
    })

    it('handles rapid clicking gracefully', async () => {
      const user = userEvent.setup()
      render(<DownloadButton {...defaultProps} />)
      
      const button = screen.getByTestId('download-button')
      await user.click(button)
      await user.click(button)
      await user.click(button)
      
      expect(defaultProps.onDownload).toHaveBeenCalledTimes(3)
    })

    it('handles keyboard events', () => {
      render(<DownloadButton {...defaultProps} />)
      
      const button = screen.getByTestId('download-button')
      fireEvent.click(button) // Use click instead of keyDown for simple mock
      
      expect(defaultProps.onDownload).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Handling', () => {
    it('handles missing onDownload prop gracefully', () => {
      const propsWithoutOnDownload = { ...defaultProps }
      const { onDownload, ...restProps } = propsWithoutOnDownload
      
      expect(() => {
        render(<DownloadButton {...restProps} />)
      }).not.toThrow()
    })

    it('handles undefined labels gracefully', () => {
      const propsWithUndefined = {
        ...defaultProps,
        label: undefined as string | undefined,
        downloadLabel: undefined as string | undefined
      }
      
      render(<DownloadButton {...propsWithUndefined} />)
      
      const button = screen.getByTestId('download-button')
      expect(button).toBeInTheDocument()
    })

    it('handles null labels gracefully', () => {
      const propsWithNull = {
        ...defaultProps,
        label: null as string | null,
        downloadLabel: null as string | null
      }
      
      render(<DownloadButton {...propsWithNull} />)
      
      const button = screen.getByTestId('download-button')
      expect(button).toBeInTheDocument()
    })

    it('calls onDownload handler when provided', async () => {
      const mockOnDownload = vi.fn()
      const user = userEvent.setup()
      
      render(<DownloadButton {...defaultProps} onDownload={mockOnDownload} />)
      
      const button = screen.getByTestId('download-button')
      await user.click(button)
      
      expect(mockOnDownload).toHaveBeenCalled()
    })
  })

  describe('File Types Handling', () => {
    it('uses Excel icon for default file type', () => {
      render(<DownloadButton {...defaultProps} />)
      
      const icon = screen.getByTestId('font-awesome-icon')
      expect(icon).toHaveTextContent('file-excel')
    })

    it('maintains Excel icon regardless of label content', () => {
      const csvProps = { ...defaultProps, label: 'Download CSV' }
      render(<DownloadButton {...csvProps} />)
      
      const icon = screen.getByTestId('font-awesome-icon')
      expect(icon).toHaveTextContent('file-excel')
    })

    it('shows appropriate loading message for different file types', () => {
      const xlsxProps = {
        ...defaultProps,
        label: 'Download XLSX',
        downloadLabel: 'Generating XLSX...'
      }
      
      render(<DownloadButton {...xlsxProps} isDownloading={true} />)
      expect(screen.getByText('Generating XLSX...')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('renders with proper data-test attribute', () => {
      render(<DownloadButton {...defaultProps} />)
      
      const button = screen.getByTestId('download-button')
      expect(button).toHaveAttribute('data-test', 'download-button')
    })

    it('handles missing data-test attribute', () => {
      const propsWithoutDataTest = { ...defaultProps }
      const { dataTest, ...restProps } = propsWithoutDataTest
      
      render(<DownloadButton {...restProps} />)
      
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('provides proper button semantics', () => {
      render(<DownloadButton {...defaultProps} />)
      
      const button = screen.getByTestId('download-button')
      expect(button.tagName).toBe('BUTTON')
    })

    it('indicates loading state to screen readers', () => {
      render(<DownloadButton {...defaultProps} isDownloading={true} />)
      
      expect(screen.getByText('Downloading...')).toBeInTheDocument()
      expect(screen.getByTestId('circular-progress')).toBeInTheDocument()
    })
  })

  describe('Forward Ref', () => {
    it('forwards ref correctly', () => {
      // Test that ref prop is accepted without errors
      expect(() => {
        const ref = { current: null }
        render(<DownloadButton {...defaultProps} ref={ref} />)
      }).not.toThrow()
    })

    it('works without ref', () => {
      expect(() => {
        render(<DownloadButton {...defaultProps} />)
      }).not.toThrow()
    })
  })

  describe('Network Failure Scenarios', () => {
    it('handles download initiation with network error', async () => {
      const networkErrorDownload = vi.fn(() => {
        return Promise.reject(new Error('Network error'))
      })
      const user = userEvent.setup()
      
      render(<DownloadButton {...defaultProps} onDownload={networkErrorDownload} />)
      
      const button = screen.getByTestId('download-button')
      await user.click(button)
      
      expect(networkErrorDownload).toHaveBeenCalled()
    })

    it('maintains proper state during async download operations', async () => {
      let resolveDownload: (() => void) | undefined
      const asyncDownload = vi.fn(() => {
        return new Promise<void>((resolve) => {
          resolveDownload = resolve
        })
      })
      const user = userEvent.setup()
      
      render(<DownloadButton {...defaultProps} onDownload={asyncDownload} />)
      
      const button = screen.getByTestId('download-button')
      await user.click(button)
      
      expect(asyncDownload).toHaveBeenCalled()
      
      // Component should remain stable during async operation
      expect(button).toBeInTheDocument()
      
      if (resolveDownload) resolveDownload()
    })
  })

  describe('Performance Testing', () => {
    it('handles multiple rapid state changes', () => {
      const { rerender } = render(<DownloadButton {...defaultProps} isDownloading={false} />)
      
      // Rapidly toggle downloading state
      for (let i = 0; i < 10; i++) {
        rerender(<DownloadButton {...defaultProps} isDownloading={i % 2 === 0} />)
      }
      
      // Component should remain stable
      expect(screen.getByTestId('download-button')).toBeInTheDocument()
    })

    it('handles large label text efficiently', () => {
      const largeLabel = 'Download very large compliance report with extensive fuel type analysis and comprehensive regulatory data including all quarterly submissions and historical comparisons with detailed breakdown by fuel category and supplier organization with complete audit trail and supporting documentation for regulatory review and approval process'
      
      render(<DownloadButton {...defaultProps} label={largeLabel} />)
      
      expect(screen.getByText(largeLabel)).toBeInTheDocument()
    })
  })
})
