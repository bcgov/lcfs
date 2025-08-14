import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import ReferenceCompareBox from '../ReferenceCompareBox'

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve())
  }
})

const mockData = [
  { label: 'Company Name', value: 'Test Company Ltd.' },
  { label: 'Registration Number', value: '123456789' },
  { value: 'No label item' }
]

describe('ReferenceCompareBox', () => {
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

  it('shows copy button on hover', async () => {
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
  })
})