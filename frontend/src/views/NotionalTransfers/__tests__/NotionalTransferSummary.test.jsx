import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor
} from '@testing-library/react'
import { BrowserRouter as Router } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NotionalTransferSummary } from '@/views/NotionalTransfers'
// Import utilities directly, if getByDataTest is a custom utility, ensure it's correctly imported
import { getByDataTest } from '@/tests/utils/testHelpers'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'mock-token',
      authenticated: true,
      initialized: true
    }
  })
}))

// Mocking Keycloak and Current User
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: {
      roles: [
        { name: 'Supplier' },
        { name: 'Government' }
      ]
    }
  })
}))

// Mock the specific import of BCDataGridServer
vi.mock('@/components/BCDataGrid/BCDataGridServer', () => ({
  // Replace BCDataGridServer with a dummy component
  __esModule: true, // This is important for mocking ES modules
  default: () => <div data-test="mockedBCDataGridServer"></div>
}))

// Mock the specific import of useApiService
vi.mock('@/services/useApiService', () => {
  const mockDownload = vi.fn(() => Promise.resolve()) // Adjust as necessary for download
  const mockPost = vi.fn(() =>
    Promise.resolve({
      data: {
        pagination: {
          total: 100, // Example total number of items
          page: 1,   // Current page number
        },
        notionalTransfers: [ // Array of items representing notional transfers
          { notionalTransferId: '001', name: 'Notional Transfer 1' },
          { notionalTransferId: '002', name: 'Notional Transfer 2' }
        ]
      }
    })
  )

  return {
    useApiService: () => ({
      download: mockDownload,
      post: mockPost
    })
  }
})

const WrapperComponent = () => {
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <Router>
          <NotionalTransferSummary />
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('NotionalTransferSummary Component Tests', () => {
  afterEach(() => {
    cleanup()
    vi.resetAllMocks() // Reset mocks to their initial state after each test
  })

  test('renders title correctly', () => {
    render(WrapperComponent())
    const title = screen.getByTestId('title')
    expect(title).toBeInTheDocument()
    expect(title.textContent).toBe('NotionalTransfers')
  })

  test('clicking new notional transfer button redirects to add page', () => {
    const { getByTestId } = render(WrapperComponent())
    const newNotionalTransferBtn = getByTestId('new-notional-transfer-btn')
    fireEvent.click(newNotionalTransferBtn)
    expect(window.location.pathname).toBe('/admin/notional-transfers/add-notional-transfer')
  })

  test('displays alert message on download failure', async () => {
    // Mocking API service to simulate download failure
    const mockApiService = {
      download: vi.fn().mockRejectedValue(new Error('Download failed'))
    }
    vi.mock('@/services/useApiService', () => ({
      useApiService: () => mockApiService
    }))

    const { getByTestId } = render(WrapperComponent())
    const downloadBtn = getByTestId('notional-transfer-download-btn')
    fireEvent.click(downloadBtn)

    await waitFor(() => {
      const alertBox = getByTestId('alert-box')
      expect(alertBox.textContent).toContain(
        'Failed to download notional transfer information.'
      )
    })
  })

  describe('Download notional transfers information', () => {
    beforeEach(() => {
      render(WrapperComponent())
    })

    it('initially shows the download notional transfers button with correct text and enabled', () => {
      const downloadButton = getByDataTest('notional-transfer-download-btn')
      expect(downloadButton).toBeInTheDocument()
      expect(downloadButton).toBeEnabled()
    })

    it('shows downloading text and disables the download notional transfers button during download', async () => {
      const mockApiService = {
        download: vi.fn(() => new Promise(() => {})), // Unresolving promise
      }
      vi.mock('@/services/useApiService', () => ({
        useApiService: () => mockApiService
      }))

      const downloadButton = getByDataTest('notional-transfer-download-btn')
      fireEvent.click(downloadButton)

      // First, ensure the button text changes to the downloading state
      await waitFor(() => {
        expect(downloadButton).toHaveTextContent(
          /Downloading notional transfers information.../i
        )
        // Then, check if the button gets disabled
        expect(downloadButton).toBeDisabled()
      })
    })

    it('shows an error message if the download notional transfers fails', async () => {
      vi.mock('@/services/useApiService', () => ({
        useApiService: () => ({
          download: vi.fn(() => Promise.reject(new Error('Download failed')))
        })
      }))

      cleanup()
      render(WrapperComponent())

      const downloadButton = getByDataTest('notional-transfer-download-btn')
      fireEvent.click(downloadButton)

      await waitFor(() => {
        const errorMessage = screen.getByText(
          /Failed to download notional transfer information./i
        )
        expect(errorMessage).toBeInTheDocument()
      })
    })
  })
})
