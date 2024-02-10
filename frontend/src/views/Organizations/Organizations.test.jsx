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
import { Organizations } from './Organizations'
// Import utilities directly, if getByDataTest is a custom utility, ensure it's correctly imported
import { getByDataTest } from '@/utils/test/testHelpers'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

// Mock the specific import of BCDataGridServer
vi.mock('@/components/BCDataGrid/BCDataGridServer', () => ({
  // Replace BCDataGridServer with a dummy component
  __esModule: true, // This is important for mocking ES modules
  default: () => <div data-testid="mockedBCDataGridServer"></div>
}))

// You need to mock the entire module where useApiService is exported
vi.mock('@/services/useApiService', () => ({
  useApiService: () => ({
    download: vi.fn(() => new Promise((resolve) => setTimeout(resolve, 100)))
  })
}))

const renderComponent = () => {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <Router>
          <Organizations />
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('Organizations Component Tests', () => {
  beforeEach(() => {
    renderComponent()
  })

  afterEach(() => {
    cleanup()
    vi.resetAllMocks() // Reset mocks to their initial state after each test
  })

  describe('Download organization information', () => {
    it('initially shows the download organization button with correct text and enabled', () => {
      const downloadButton = getByDataTest('download-org-button')
      expect(downloadButton).toBeInTheDocument()
      expect(downloadButton).toBeEnabled()
    })

    it('shows downloading text and disables the download organization button during download', async () => {
      const downloadButton = getByDataTest('download-org-button')
      fireEvent.click(downloadButton)

      // First, ensure the button text changes to the downloading state
      await waitFor(() => {
        expect(downloadButton).toHaveTextContent(
          /Downloading organization information.../i
        )
      })
      // Then, check if the button gets disabled
      expect(downloadButton).toBeDisabled()
    })

    it('shows an error message if the download organization fails', async () => {
      vi.mock('@/services/useApiService', () => ({
        useApiService: () => ({
          download: vi.fn(() => Promise.reject(new Error('Download failed')))
        })
      }))

      cleanup()
      renderComponent()

      const downloadButton = getByDataTest('download-org-button')
      fireEvent.click(downloadButton)

      await waitFor(() => {
        const errorMessage = screen.getByText(
          /Failed to download organization information./i
        )
        expect(errorMessage).toBeInTheDocument()
      })
    })
  })

  describe('Download user information', () => {
    beforeEach(() => {
      // Mock the download function to always resolve successfully for user info
      vi.mock('@/services/useApiService', () => ({
        useApiService: () => ({
          downloadUser: vi.fn(() => Promise.resolve())
        })
      }))
    })

    afterEach(() => {
      cleanup()
      vi.restoreAllMocks() // Ensure mocks are cleared and restored after each test
    })

    it('initially shows the download user button with correct text and enabled', () => {
      const downloadButton = getByDataTest('download-user-button')
      expect(downloadButton).toBeInTheDocument()
      expect(downloadButton).toBeEnabled()
    })

    it('shows downloading text and disables the download user button during download', async () => {
      const downloadButton = getByDataTest('download-user-button')
      fireEvent.click(downloadButton)

      expect(
        screen.queryByText(/Downloading User Information.../i)
      ).toBeInTheDocument()

      await waitFor(() => {
        expect(downloadButton).toHaveTextContent(
          /Downloading user information.../i
        )
      })
      expect(downloadButton).toBeDisabled()
    })

    it('shows an error message if the download user fails', async () => {
      vi.mock('@/services/useApiService', () => ({
        useApiService: () => ({
          downloadUser: vi.fn(() =>
            Promise.reject(new Error('Download failed'))
          ) // Mock failure for download
        })
      }))

      cleanup()
      renderComponent()

      const downloadButton = getByDataTest('download-user-button')
      fireEvent.click(downloadButton)

      await waitFor(() => {
        const errorMessage = screen.getByText(
          /Failed to download user information./i
        )
        expect(errorMessage).toBeInTheDocument()
      })
    })
  })
})
