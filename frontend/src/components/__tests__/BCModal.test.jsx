import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BCModal from '@/components/BCModal'

// Unmock the component we're testing (overrides global mock)
vi.unmock('@/components/BCModal')

// Mock BCButton to avoid theme/function errors in tests  
vi.mock('@/components/BCButton', () => ({
  __esModule: true,
  default: ({ children, onClick, 'data-test': dataTest, id, variant, color, ...props }) => (
    <button onClick={onClick} data-test={dataTest} id={id} role="button" {...props}>
      {children}
    </button>
  )
}))

// Mock MUI components
vi.mock('@mui/material', () => ({
  Dialog: ({ children, open, onClose, 'data-test': dataTest, ...props }) => 
    open ? <div data-test={dataTest || 'modal'} role="dialog">{children}</div> : null,
  DialogTitle: ({ children }) => <div>{children}</div>,
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogActions: ({ children }) => <div>{children}</div>,
  IconButton: ({ children, onClick, 'aria-label': ariaLabel, 'data-test': dataTest, sx, ...props }) => (
    <button 
      onClick={onClick} 
      aria-label={ariaLabel} 
      data-test={dataTest}
      role="button"
      {...props}
    >
      {children}
    </button>
  ),
  Box: ({ children, dangerouslySetInnerHTML, 'data-test': dataTest, bgcolor, borderRadius, p, display, gap, ...props }) => {
    if (dangerouslySetInnerHTML) {
      return <div data-test={dataTest} dangerouslySetInnerHTML={dangerouslySetInnerHTML} {...props} />
    }
    return <div data-test={dataTest} {...props}>{children}</div>
  },
  Divider: () => <hr />
}))

vi.mock('@mui/icons-material', () => ({
  Close: () => <span>×</span>,
  Warning: () => <span>⚠</span>
}))

const baseData = {
  content: <div data-test="modal-content">Modal Content</div>,
  title: 'Test Modal'
}

describe('Not Found Component', () => {
  it('Should render the BCModal component when open param is true', () => {
    render(<BCModal open={true} onClose={vi.fn()} data={baseData} />)
    expect(screen.getByTestId('modal')).toBeInTheDocument()
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByTestId('modal-content')).toBeInTheDocument()
  })

  it('Should close the BCModal component when onClose is triggered', () => {
    const onClose = vi.fn()
    render(<BCModal open={true} onClose={onClose} data={baseData} />)
    // The close button has data-test="modal-btn-close" and aria-label="close"
    const closeButton = screen.getByTestId('modal-btn-close')
    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalled()
  })

  it('should render data if data is not null', async () => {
    render(<BCModal open={true} onClose={vi.fn()} data={baseData} />)
    expect(screen.getByTestId('modal-content')).toBeInTheDocument()
  })

  it('should render nothing if data is null', async () => {
    const { container } = render(
      <BCModal open={true} onClose={vi.fn()} data={null} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('should call handlePrimaryButtonClick when primaryButtonText button is clicked', async () => {
    const primaryButtonAction = vi.fn()
    const data = {
      ...baseData,
      primaryButtonText: 'Confirm',
      primaryButtonAction
    }
    render(<BCModal open={true} onClose={vi.fn()} data={data} />)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    // Wait for async action
    await Promise.resolve()
    expect(primaryButtonAction).toHaveBeenCalled()
  })

  it('should call handleSecondaryButtonClick when secondaryButtonText button is clicked', async () => {
    const secondaryButtonAction = vi.fn()
    const data = {
      ...baseData,
      secondaryButtonText: 'Cancel',
      secondaryButtonAction
    }
    render(<BCModal open={true} onClose={vi.fn()} data={data} />)
    fireEvent.click(screen.getByTestId('modal-btn-secondary'))
    expect(secondaryButtonAction).toHaveBeenCalled()
  })

  it('should render warningText when warningText is true', async () => {
    const warningText = 'This is a warning!'
    const data = {
      ...baseData,
      warningText
    }
    render(<BCModal open={true} onClose={vi.fn()} data={data} />)
    // The warning text should be rendered in a div with data-test="text-warning"
    expect(screen.getByTestId('text-warning')).toBeInTheDocument()
  })
})
