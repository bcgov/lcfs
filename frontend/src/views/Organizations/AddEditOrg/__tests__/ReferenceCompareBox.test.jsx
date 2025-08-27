import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterAll } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import ReferenceCompareBox from '../ReferenceCompareBox'

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve())
  }
})

// Mock console.error to capture error messages
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

const mockData = [
  { label: 'Company Name', value: 'Test Company Ltd.' },
  { label: 'Registration Number', value: '123456789' },
  { value: 'No label item' }
]

const singleItemData = [
  { label: 'Single Item', value: 'Single Value' }
]

describe('ReferenceCompareBox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navigator.clipboard.writeText.mockResolvedValue()
  })

  afterAll(() => {
    mockConsoleError.mockRestore()
  })

  it('renders with data items', () => {
    render(
      <ReferenceCompareBox
        title="Reference Data"
        data={mockData}
        onDismiss={vi.fn()}
      />,
      { wrapper }
    )

    expect(screen.getByText('Test Company Ltd.')).toBeInTheDocument()
    expect(screen.getByText('123456789')).toBeInTheDocument()
    expect(screen.getByText('No label item')).toBeInTheDocument()
  })

  it('returns null when isDismissed is true', () => {
    const { container } = render(
      <ReferenceCompareBox
        title="Reference Data"
        data={mockData}
        onDismiss={vi.fn()}
        isDismissed={true}
      />,
      { wrapper }
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('calls onDismiss when close button is clicked', () => {
    const onDismiss = vi.fn()
    render(
      <ReferenceCompareBox
        title="Reference Data"
        data={mockData}
        onDismiss={onDismiss}
      />,
      { wrapper }
    )

    fireEvent.click(screen.getByLabelText('Dismiss reference'))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('copies text to clipboard when item is clicked', async () => {
    render(
      <ReferenceCompareBox
        title="Reference Data"
        data={mockData}
        onDismiss={vi.fn()}
      />,
      { wrapper }
    )

    fireEvent.click(screen.getByText('Test Company Ltd.'))
    
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test Company Ltd.')
    })
  })

  it('shows copy button on hover and hides on mouse leave', async () => {
    render(
      <ReferenceCompareBox
        title="Reference Data"
        data={mockData}
        onDismiss={vi.fn()}
      />,
      { wrapper }
    )

    const firstItem = screen.getByText('Test Company Ltd.').closest('div')
    fireEvent.mouseEnter(firstItem)

    await waitFor(() => {
      expect(screen.getAllByLabelText('Copy to clipboard')).toHaveLength(3)
    })

    fireEvent.mouseLeave(firstItem)

    await waitFor(() => {
      expect(screen.queryByLabelText('Copy to clipboard')).not.toBeInTheDocument()
    })
  })

  it('handles clipboard write error gracefully', async () => {
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Clipboard failed'))
    
    render(
      <ReferenceCompareBox
        title="Reference Data"
        data={mockData}
        onDismiss={vi.fn()}
      />,
      { wrapper }
    )

    fireEvent.click(screen.getByText('Test Company Ltd.'))
    
    await waitFor(() => {
      expect(mockConsoleError).toHaveBeenCalledWith('Failed to copy text: ', expect.any(Error))
    })
  })

  it('shows copied state and resets after timeout', async () => {
    vi.useFakeTimers()
    
    render(
      <ReferenceCompareBox
        title="Reference Data"
        data={mockData}
        onDismiss={vi.fn()}
      />,
      { wrapper }
    )

    const firstItem = screen.getByText('Test Company Ltd.').closest('div')
    fireEvent.mouseEnter(firstItem)
    fireEvent.click(screen.getByText('Test Company Ltd.'))
    
    await waitFor(() => {
      expect(screen.getByLabelText('Copied!')).toBeInTheDocument()
    })

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    await waitFor(() => {
      expect(screen.queryByLabelText('Copied!')).not.toBeInTheDocument()
    })
    
    vi.useRealTimers()
  })

  it('renders items without labels correctly', () => {
    render(
      <ReferenceCompareBox
        title="Reference Data"
        data={mockData}
        onDismiss={vi.fn()}
      />,
      { wrapper }
    )

    expect(screen.getByText('No label item')).toBeInTheDocument()
    expect(screen.queryByText('No label item:')).not.toBeInTheDocument()
  })

  it('shows close button only on first item', () => {
    render(
      <ReferenceCompareBox
        title="Reference Data"
        data={mockData}
        onDismiss={vi.fn()}
      />,
      { wrapper }
    )

    expect(screen.getByLabelText('Dismiss reference')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Dismiss reference')).toHaveLength(1)
  })

  it('renders single item correctly', () => {
    render(
      <ReferenceCompareBox
        title="Reference Data"
        data={singleItemData}
        onDismiss={vi.fn()}
      />,
      { wrapper }
    )

    expect(screen.getByText('Single Value')).toBeInTheDocument()
    expect(screen.getByLabelText('Dismiss reference')).toBeInTheDocument()
  })

  it('copies correct value when clicking different items', async () => {
    render(
      <ReferenceCompareBox
        title="Reference Data"
        data={mockData}
        onDismiss={vi.fn()}
      />,
      { wrapper }
    )

    fireEvent.click(screen.getByText('123456789'))
    
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('123456789')
    })

    fireEvent.click(screen.getByText('No label item'))
    
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('No label item')
    })
  })

  it('prevents event propagation on dismiss button click', () => {
    const onDismiss = vi.fn()
    render(
      <ReferenceCompareBox
        title="Reference Data"
        data={mockData}
        onDismiss={onDismiss}
      />,
      { wrapper }
    )

    fireEvent.click(screen.getByLabelText('Dismiss reference'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })
})