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
import { getByDataTest } from '@/utils/test/testHelpers'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

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
  })

  describe('Download organization information', () => {
    beforeEach(() => {
      // Mock the download function to always resolve successfully
      vi.mock('@/services/useApiService', () => ({
        useApiService: () => ({
          download: vi.fn().mockResolvedValueOnce()
        })
      }))
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('initially shows the download organization button with correct text and enabled', () => {
      const downloadButton = getByDataTest('download-org-button')
      expect(downloadButton).toBeInTheDocument()
      expect(downloadButton).toBeEnabled()
    })

    it('shows downloading text and disables the download organization button during download', async () => {
      const downloadButton = getByDataTest('download-org-button')
      fireEvent.click(downloadButton)

      // Wait for the download operation to complete and the component state to update
      await waitFor(() => {
        expect(downloadButton).toHaveTextContent(
          /Downloading Organization Information.../i
        )
        expect(downloadButton).toBeDisabled()
      })
    })

    it('shows an error message if the download organization fails', async () => {
      // Update the mock to simulate a failure
      vi.mock('@/services/useApiService', () => ({
        useApiService: () => ({
          download: vi.fn().mockRejectedValueOnce(new Error('Download failed'))
        })
      }))

      cleanup()
      renderComponent()

      const downloadButton = getByDataTest('download-org-button')
      fireEvent.click(downloadButton)

      // Wait for the component to react to the error
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
      // Mock the download function to always resolve successfully
      vi.mock('@/services/useApiService', () => ({
        useApiService: () => ({
          download: vi.fn().mockResolvedValueOnce()
        })
      }))
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('initially shows the download user button with correct text and enabled', () => {
      const downloadButton = getByDataTest('download-user-button')
      expect(downloadButton).toBeInTheDocument()
      expect(downloadButton).toBeEnabled()
    })

    it('shows downloading text and disables the download user button during download', async () => {
      const downloadButton = getByDataTest('download-user-button')
      fireEvent.click(downloadButton)

      // Wait for the download operation to complete and the component state to update
      await waitFor(() => {
        expect(downloadButton).toHaveTextContent(
          /Downloading User Information.../i
        )
        expect(downloadButton).toBeDisabled()
      })
    })

    it('shows an error message if the download user fails', async () => {
      // Update the mock to simulate a failure
      vi.mock('@/services/useApiService', () => ({
        useApiService: () => ({
          download: vi.fn().mockRejectedValueOnce(new Error('Download failed'))
        })
      }))

      cleanup()
      renderComponent()

      const downloadButton = getByDataTest('download-user-button')
      fireEvent.click(downloadButton)

      // Wait for the component to react to the error
      await waitFor(() => {
        const errorMessage = screen.getByText(
          /Failed to download user information./i
        )
        expect(errorMessage).toBeInTheDocument()
      })
    })
  })
})
