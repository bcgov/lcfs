import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/extend-expect'
import { vi } from 'vitest'
import SupportingDocumentSummary from '@/components/SupportingDocumentSummary'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'

// Mock API service
vi.mock('@/services/useApiService', () => ({
  useApiService: vi.fn()
}))

describe('SupportingDocumentSummary', () => {
  const reportID = '123'
  const data = [
    { documentId: '1', fileName: 'example1.txt' },
    { documentId: '2', fileName: 'example2.txt' }
  ]

  beforeEach(() => {
    useApiService.mockReturnValue({
      get: vi.fn((url) => {
        if (url.includes('1')) {
          return Promise.resolve({ data: { url: 'http://example.com/doc1' } })
        } else if (url.includes('2')) {
          return Promise.resolve({ data: { url: 'http://example.com/doc2' } })
        }
      })
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<SupportingDocumentSummary reportID={reportID} data={data} />, {
      wrapper
    })
    expect(screen.getByText('example1.txt')).toBeInTheDocument()
    expect(screen.getByText('example2.txt')).toBeInTheDocument()
  })

  it('opens document when clicked', async () => {
    render(<SupportingDocumentSummary reportID={reportID} data={data} />, {
      wrapper
    })
    const firstDocumentLink = screen.getByText('example1.txt')

    window.open = vi.fn()

    fireEvent.click(firstDocumentLink)

    await waitFor(() => {
      expect(useApiService().get).toHaveBeenCalledWith(
        expect.stringContaining('1')
      )
      expect(window.open).toHaveBeenCalledWith(
        'http://example.com/doc1',
        '_blank'
      )
    })
  })

  it('does not open document if documentID is missing', async () => {
    render(
      <SupportingDocumentSummary
        reportID={reportID}
        data={[{ documentId: '', fileName: 'example3.txt' }]}
      />,
      { wrapper }
    )
    const documentLink = screen.getByText('example3.txt')

    window.open = vi.fn()

    fireEvent.click(documentLink)

    await waitFor(() => {
      expect(useApiService().get).not.toHaveBeenCalled()
      expect(window.open).not.toHaveBeenCalled()
    })
  })
})
