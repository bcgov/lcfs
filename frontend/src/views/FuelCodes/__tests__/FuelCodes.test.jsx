import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { FuelCodes } from '@/views/FuelCodes'
import { roles } from '@/constants/roles.js'
import { wrapper } from '@/tests/utils/wrapper'

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
      roles: [{ name: roles.government }, { name: roles.analyst }]
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
  const mockDownload = vi.fn().mockResolvedValue(Promise.resolve())
  const mockPost = vi.fn().mockResolvedValue({
    data: {
      pagination: {
        total: 100, // Example total number of items
        page: 1 // Current page number
      },
      fuelCodes: [
        // Array of items representing fuel codes
        { fuelCodeId: '001', name: 'Fuel Code 1' },
        { fuelCodeId: '002', name: 'Fuel Code 2' }
      ]
    }
  })

  return {
    useApiService: () => ({
      download: mockDownload,
      post: mockPost
    })
  }
})

describe('FuelCodes Component Tests', () => {
  afterEach(() => {
    cleanup()
    vi.resetAllMocks() // Reset mocks to their initial state after each test
  })

  it('renders title correctly', () => {
    render(<FuelCodes />, { wrapper })
    const title = screen.getByTestId('title')
    expect(title).toBeInTheDocument()
    expect(title.textContent).toBe('Fuel codes')
  })

  it('clicking new fuel code button redirects to add page', () => {
    render(<FuelCodes />, { wrapper })
    const newFuelCodeBtn = screen.getByTestId('new-fuel-code-btn')
    fireEvent.click(newFuelCodeBtn)
    expect(window.location.pathname).toBe('/fuel-codes/add-fuel-code')
  })

  it('displays alert message on download failure', async () => {
    // Mocking API service to simulate download failure
    const mockApiService = {
      download: vi.fn().mockRejectedValue(new Error('Download failed'))
    }
    vi.mock('@/services/useApiService', () => ({
      useApiService: () => mockApiService
    }))

    render(<FuelCodes />, { wrapper })
    const downloadBtn = screen.getByTestId('fuel-code-download-btn')
    fireEvent.click(downloadBtn)

    await waitFor(() => {
      const alertBox = screen.getByTestId('alert-box')
      expect(alertBox.textContent).toContain(
        'Failed to download fuel code information'
      )
    })
  })

  describe('Download fuel codes information', () => {
    beforeEach(() => {
      render(<FuelCodes />, { wrapper })
    })

    it('initially shows the download fuel codes button with correct text and enabled', () => {
      const downloadButton = screen.getByTestId('fuel-code-download-btn')
      expect(downloadButton).toBeInTheDocument()
      expect(downloadButton).toBeEnabled()
    })

    it('shows downloading text and disables the download fuel codes button during download', async () => {
      const mockApiService = {
        download: vi.fn(() => new Promise(() => {})) // Unresolving promise
      }
      vi.mock('@/services/useApiService', () => ({
        useApiService: () => mockApiService
      }))

      const downloadButton = screen.getByTestId('fuel-code-download-btn')
      fireEvent.click(downloadButton)

      // First, ensure the button text changes to the downloading state
      await waitFor(() => {
        expect(downloadButton).toHaveTextContent(
          /Downloading fuel codes information.../i
        )
        // Then, check if the button gets disabled
        expect(downloadButton).toBeDisabled()
      })
    })

    it('shows an error message if the download fuel codes fails', async () => {
      vi.mock('@/services/useApiService', () => ({
        useApiService: () => ({
          download: vi.fn(() => Promise.reject(new Error('Download failed')))
        })
      }))

      cleanup()
      render(<FuelCodes />, { wrapper })

      const downloadButton = screen.getByTestId('fuel-code-download-btn')
      fireEvent.click(downloadButton)

      await waitFor(() => {
        const errorMessage = screen.getByText(
          /Failed to download fuel code information./i
        )
        expect(errorMessage).toBeInTheDocument()
      })
    })
  })
})
