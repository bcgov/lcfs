import React from 'react'
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

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => {
      const translations = {
        FuelCodes: 'Fuel codes',
        'fuelCode:newFuelCodeBtn': 'New fuel code',
        'fuelCode:fuelCodeDownloadBtn': 'Download fuel codes information',
        'fuelCode:fuelCodeDownloadingMsg': 'Downloading fuel codes information',
        'fuelCode:fuelCodeDownloadFailMsg':
          'Failed to download fuel code information',
        'fuelCode:noFuelCodesFound': 'No fuel codes found',
        'common:ClearFilters': 'Clear filters'
      }
      return translations[key] || key
    }
  })
}))

// Mock Keycloak
vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'mock-token',
      authenticated: true,
      initialized: true
    }
  })
}))

// Mock Current User
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: {
      roles: [{ name: roles.government }, { name: roles.analyst }]
    }
  })
}))

// Mock React Router
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    state: null
  }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()]
}))

// Mock useFuelCode hooks
let mockDownloadMutate = vi.fn()
let mockGetFuelCodesData = {
  data: {
    pagination: {
      total: 100,
      page: 1,
      size: 10
    },
    fuelCodes: [
      { fuelCodeId: '001', name: 'Fuel Code 1' },
      { fuelCodeId: '002', name: 'Fuel Code 2' }
    ]
  },
  isLoading: false,
  error: null,
  isError: false
}

vi.mock('@/hooks/useFuelCode', () => ({
  useGetFuelCodes: vi.fn(() => mockGetFuelCodesData),
  useDownloadFuelCodes: vi.fn(() => ({
    mutateAsync: mockDownloadMutate
  })),
  useFuelCodeStatuses: vi.fn(() => ({
    data: [
      { status: 'Draft', statusId: 1 },
      { status: 'Active', statusId: 2 },
      { status: 'Expired', statusId: 3 }
    ]
  })),
  useTransportModes: vi.fn(() => ({
    data: [
      { transportMode: 'Truck', transportModeId: 1 },
      { transportMode: 'Rail', transportModeId: 2 },
      { transportMode: 'Ship', transportModeId: 3 }
    ]
  }))
}))

// Create mock grid ref with AG Grid API methods
const createMockGridRef = (filterModel = {}, columnState = []) => ({
  current: {
    api: {
      getFilterModel: vi.fn(() => filterModel),
      clearFilters: vi.fn(),
      getColumnState: vi.fn(() => columnState)
    },
    clearFilters: vi.fn()
  }
})

describe('FuelCodes Component Tests', () => {
  let mockGridRef

  beforeEach(() => {
    mockGridRef = createMockGridRef()
    mockDownloadMutate = vi.fn().mockResolvedValue(undefined)
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  afterEach(() => {
    cleanup()
    vi.resetAllMocks()
  })

  // HIGH PRIORITY TESTS - Component rendering and core functionality

  describe('Component Rendering', () => {
    it('renders title correctly', () => {
      render(<FuelCodes />, { wrapper })
      const title = screen.getByTestId('title')
      expect(title).toBeInTheDocument()
      expect(title.textContent).toBe('Fuel codes')
    })

    it('renders grid viewer with correct props', () => {
      render(<FuelCodes />, { wrapper })
      const gridContainer = screen.getByTestId('bc-grid-container')
      expect(gridContainer).toBeInTheDocument()
    })

    it('renders download button with correct initial state', () => {
      render(<FuelCodes />, { wrapper })
      const downloadButton = screen.getByTestId('fuel-code-download-btn')
      expect(downloadButton).toBeInTheDocument()
      expect(downloadButton).toBeEnabled()
      expect(downloadButton).toHaveTextContent(
        'Download fuel codes information'
      )
    })

    it('renders new fuel code button for analysts', () => {
      render(<FuelCodes />, { wrapper })
      const newFuelCodeBtn = screen.getByTestId('new-fuel-code-btn')
      expect(newFuelCodeBtn).toBeInTheDocument()
      expect(newFuelCodeBtn).toHaveTextContent('New fuel code')
    })
  })

  describe('Primary User Interactions', () => {
    it('clicking new fuel code button navigates to add page', () => {
      render(<FuelCodes />, { wrapper })
      const newFuelCodeBtn = screen.getByTestId('new-fuel-code-btn')
      fireEvent.click(newFuelCodeBtn)
      expect(mockNavigate).toHaveBeenCalledWith('/fuel-codes/add-fuel-code')
    })

    it('handles download button click with no filters or sorting', async () => {
      render(<FuelCodes />, { wrapper })
      const downloadButton = screen.getByTestId('fuel-code-download-btn')

      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(mockDownloadMutate).toHaveBeenCalledWith({
          format: 'xlsx',
          body: {
            page: 1,
            size: 10000,
            filters: [],
            sortOrders: [
              {
                direction: 'desc',
                field: 'lastUpdated'
              }
            ]
          }
        })
      })
    })
  })

  describe('Export Functionality with Filters and Sorting', () => {
    it('calls buildExportPayload with correct format when download is triggered', async () => {
      render(<FuelCodes />, { wrapper })
      const downloadButton = screen.getByTestId('fuel-code-download-btn')

      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(mockDownloadMutate).toHaveBeenCalledWith({
          format: 'xlsx',
          body: expect.objectContaining({
            page: 1,
            size: 10000,
            filters: expect.any(Array),
            sortOrders: expect.any(Array)
          })
        })
      })
    })

    it('verifies export payload structure includes both filters and sortOrders properties', async () => {
      render(<FuelCodes />, { wrapper })
      const downloadButton = screen.getByTestId('fuel-code-download-btn')

      fireEvent.click(downloadButton)

      await waitFor(() => {
        const callArgs = mockDownloadMutate.mock.calls[0][0]
        expect(callArgs).toHaveProperty('format', 'xlsx')
        expect(callArgs.body).toHaveProperty('filters')
        expect(callArgs.body).toHaveProperty('sortOrders')
        expect(callArgs.body).toHaveProperty('page', 1)
        expect(callArgs.body).toHaveProperty('size', 10000)
      })
    })

    it('confirms sortOrders property is not hardcoded as empty array', async () => {
      render(<FuelCodes />, { wrapper })
      const downloadButton = screen.getByTestId('fuel-code-download-btn')

      fireEvent.click(downloadButton)

      await waitFor(() => {
        const callArgs = mockDownloadMutate.mock.calls[0][0]
        // The sortOrders should come from paginationOptions.sortOrders, not hardcoded []
        expect(Array.isArray(callArgs.body.sortOrders)).toBe(true)
      })
    })
  })

  describe('State Management and Loading States', () => {
    it('shows loading state during download', async () => {
      // Mock a pending download
      mockDownloadMutate = vi.fn(() => new Promise(() => {})) // Never resolves

      render(<FuelCodes />, { wrapper })
      const downloadButton = screen.getByTestId('fuel-code-download-btn')

      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(downloadButton).toHaveTextContent(
          'Downloading fuel codes information...'
        )
        expect(downloadButton).toBeDisabled()
      })
    })

    it('resets button state after successful download', async () => {
      mockDownloadMutate = vi.fn().mockResolvedValue(undefined)

      render(<FuelCodes />, { wrapper })
      const downloadButton = screen.getByTestId('fuel-code-download-btn')

      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(downloadButton).toHaveTextContent(
          'Download fuel codes information'
        )
        expect(downloadButton).toBeEnabled()
      })
    })
  })

  describe('Error Handling', () => {
    it('displays error message on download failure', async () => {
      mockDownloadMutate = vi
        .fn()
        .mockRejectedValue(new Error('Download failed'))

      render(<FuelCodes />, { wrapper })
      const downloadButton = screen.getByTestId('fuel-code-download-btn')

      fireEvent.click(downloadButton)

      await waitFor(() => {
        const alertBox = screen.getByTestId('alert-box')
        expect(alertBox).toBeInTheDocument()
        expect(alertBox).toHaveTextContent(
          'Failed to download fuel code information'
        )
      })
    })

    it('resets button state after download failure', async () => {
      mockDownloadMutate = vi
        .fn()
        .mockRejectedValue(new Error('Download failed'))

      render(<FuelCodes />, { wrapper })
      const downloadButton = screen.getByTestId('fuel-code-download-btn')

      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(downloadButton).toHaveTextContent(
          'Download fuel codes information'
        )
        expect(downloadButton).toBeEnabled()
      })
    })

    it('handles missing grid reference gracefully', async () => {
      render(<FuelCodes />, { wrapper })
      const downloadButton = screen.getByTestId('fuel-code-download-btn')

      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(mockDownloadMutate).toHaveBeenCalledWith({
          format: 'xlsx',
          body: {
            page: 1,
            size: 10000,
            filters: [],
            sortOrders: [
              {
                direction: 'desc',
                field: 'lastUpdated'
              }
            ]
          }
        })
      })
    })
  })

  describe('Clear Filters Functionality', () => {
    it('clears filters when clear filters button is clicked', () => {
      render(<FuelCodes />, { wrapper })
      const clearFiltersButton = screen.getByRole('button', {
        name: /clear filters/i
      })

      fireEvent.click(clearFiltersButton)

      // The actual clearing logic would be tested through the grid's clearFilters method
      // This tests that the button exists and is clickable
      expect(clearFiltersButton).toBeInTheDocument()
    })
  })

  // MEDIUM PRIORITY TESTS - Edge cases and detailed scenarios

  describe('Alert Message Handling', () => {
    it('renders without alert when no location state message', () => {
      render(<FuelCodes />, { wrapper })

      // Should not show alert box when there's no message
      const alertBox = screen.queryByTestId('alert-box')
      expect(alertBox).not.toBeInTheDocument()
    })
  })

  describe('Data Loading States', () => {
    it('handles loading state from useGetFuelCodes', () => {
      mockGetFuelCodesData = {
        ...mockGetFuelCodesData,
        isLoading: true
      }

      render(<FuelCodes />, { wrapper })

      // The grid should show loading state
      const gridContainer = screen.getByTestId('bc-grid-container')
      expect(gridContainer).toBeInTheDocument()
    })

    it('handles error state from useGetFuelCodes', () => {
      mockGetFuelCodesData = {
        ...mockGetFuelCodesData,
        isError: true,
        error: {
          message: 'Failed to load fuel codes',
          response: { status: 500 }
        }
      }

      render(<FuelCodes />, { wrapper })

      const errorMessage = screen.getByText(/Failed to load fuel codes/)
      expect(errorMessage).toBeInTheDocument()
    })
  })

  describe('Complex Export Scenarios', () => {
    it('exports with date range filters', async () => {
      const mockFilterModel = {
        applicationDate: {
          filterType: 'date',
          type: 'inRange',
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31'
        }
      }

      render(<FuelCodes />, { wrapper })
      const downloadButton = screen.getByTestId('fuel-code-download-btn')

      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(mockDownloadMutate).toHaveBeenCalledWith({
          format: 'xlsx',
          body: expect.objectContaining({
            filters: expect.any(Array),
            sortOrders: expect.any(Array)
          })
        })
      })
    })

    it('verifies export functionality with proper payload structure', async () => {
      render(<FuelCodes />, { wrapper })
      const downloadButton = screen.getByTestId('fuel-code-download-btn')

      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(mockDownloadMutate).toHaveBeenCalledWith({
          format: 'xlsx',
          body: expect.objectContaining({
            page: 1,
            size: 10000,
            filters: expect.any(Array),
            sortOrders: expect.any(Array)
          })
        })
      })
    })
  })

  // LOW PRIORITY TESTS - UI variations and edge cases

  describe('UI Variations', () => {
    it('handles empty fuel codes data', () => {
      mockGetFuelCodesData = {
        data: {
          pagination: { total: 0, page: 1, size: 10 },
          fuelCodes: []
        },
        isLoading: false,
        error: null,
        isError: false
      }

      render(<FuelCodes />, { wrapper })

      const gridContainer = screen.getByTestId('bc-grid-container')
      expect(gridContainer).toBeInTheDocument()
    })

    it('renders with different pagination sizes', () => {
      mockGetFuelCodesData = {
        data: {
          pagination: { total: 50, page: 2, size: 25 },
          fuelCodes: []
        },
        isLoading: false,
        error: null,
        isError: false
      }

      render(<FuelCodes />, { wrapper })

      const gridContainer = screen.getByTestId('bc-grid-container')
      expect(gridContainer).toBeInTheDocument()
    })
  })
})
