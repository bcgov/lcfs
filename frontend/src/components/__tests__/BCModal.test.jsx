import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BCModal from '@/components/BCModal'

// Mock BCButton to avoid theme/function errors in tests
vi.mock('@/components/BCButton', () => ({
  __esModule: true,
  default: ({ children, ...props }) => <button {...props}>{children}</button>
}))

// Mock for window.location.assign for navigation
const originalLocation = window.location
beforeAll(() => {
  delete window.location
  window.location = { assign: vi.fn() }
})
afterAll(() => {
  window.location = originalLocation
})

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
    fireEvent.click(screen.getByTestId('modal-btn-close'))
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
    fireEvent.click(screen.getByTestId('modal-btn-primary'))
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
    expect(screen.getByTestId('text-warning')).toBeInTheDocument()
    expect(screen.getByTestId('text-warning').innerHTML).toContain(warningText)
  })
})
