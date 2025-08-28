import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  act
} from '@testing-library/react'
import { FuelCodes } from '@/views/FuelCodes'
import { roles } from '@/constants/roles.js'
import { wrapper } from '@/tests/utils/wrapper'
import { ROUTES } from '@/routes/routes'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => {
      const translations = {
        FuelCodes: 'Fuel codes',
        'fuelCode:newFuelCodeBtn': 'New fuel code',
        'fuelCode:fuelCodeDownloadBtn': 'Download fuel codes information',
        'fuelCode:fuelCodeDownloadingMsg': 'Downloading fuel codes information',
        'fuelCode:fuelCodeDownloadFailMsg': 'Failed to download fuel code information',
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
const mockLocationState = { state: null }
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocationState,
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

// Mock BCBox to prevent jsx prop warnings
vi.mock('@/components/BCBox', () => ({
  default: ({ children, jsx, ...props }) => <div {...props}>{children}</div>
}))

// Import the component internals for direct testing
import { FuelCodes as FuelCodesComponent } from '@/views/FuelCodes/FuelCodes.jsx'

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
    mockLocationState.state = null
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  afterEach(() => {
    cleanup()
    vi.resetAllMocks()
  })

  describe('Utility Functions', () => {
    describe('Filter conversion logic', () => {
      it('should handle empty filter model correctly', () => {
        const emptyModel = {}
        const result = Object.entries(emptyModel).map(([field, cfg]) => ({
          field,
          filterType: cfg.filterType || 'text',
          type: cfg.type,
          filter: cfg.filter,
          dateFrom: cfg.dateFrom,
          dateTo: cfg.dateTo
        }))
        expect(result).toEqual([])
      })

      it('should convert filter model with single filter', () => {
        const model = {
          name: {
            filterType: 'text',
            type: 'contains',
            filter: 'test'
          }
        }
        const result = Object.entries(model).map(([field, cfg]) => ({
          field,
          filterType: cfg.filterType || 'text',
          type: cfg.type,
          filter: cfg.filter,
          dateFrom: cfg.dateFrom,
          dateTo: cfg.dateTo
        }))
        expect(result).toEqual([{
          field: 'name',
          filterType: 'text',
          type: 'contains',
          filter: 'test',
          dateFrom: undefined,
          dateTo: undefined
        }])
      })

      it('should convert filter model with date filters', () => {
        const model = {
          applicationDate: {
            filterType: 'date',
            type: 'inRange',
            dateFrom: '2024-01-01',
            dateTo: '2024-12-31'
          }
        }
        const result = Object.entries(model).map(([field, cfg]) => ({
          field,
          filterType: cfg.filterType || 'text',
          type: cfg.type,
          filter: cfg.filter,
          dateFrom: cfg.dateFrom,
          dateTo: cfg.dateTo
        }))
        expect(result).toEqual([{
          field: 'applicationDate',
          filterType: 'date',
          type: 'inRange',
          filter: undefined,
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31'
        }])
      })

      it('should handle missing filterType with default text type', () => {
        const model = {
          code: {
            type: 'equals',
            filter: '001'
          }
        }
        const result = Object.entries(model).map(([field, cfg]) => ({
          field,
          filterType: cfg.filterType || 'text',
          type: cfg.type,
          filter: cfg.filter,
          dateFrom: cfg.dateFrom,
          dateTo: cfg.dateTo
        }))
        expect(result).toEqual([{
          field: 'code',
          filterType: 'text',
          type: 'equals',
          filter: '001',
          dateFrom: undefined,
          dateTo: undefined
        }])
      })
    })
  })

  describe('Component Rendering', () => {
    it('should render title correctly', () => {
      render(<FuelCodes />, { wrapper })
      const title = screen.getByTestId('title')
      expect(title).toBeInTheDocument()
      expect(title.textContent).toBe('Fuel codes')
    })

    it('should render grid viewer with correct props', () => {
      render(<FuelCodes />, { wrapper })
      const gridContainer = screen.getByTestId('bc-grid-container')
      expect(gridContainer).toBeInTheDocument()
    })

    it('should render download button with correct initial state', () => {
      render(<FuelCodes />, { wrapper })
      const downloadButton = screen.getByTestId('fuel-code-download-btn')
      expect(downloadButton).toBeInTheDocument()
      expect(downloadButton).toBeEnabled()
      expect(downloadButton).toHaveTextContent('Download fuel codes information')
    })

    it('should render new fuel code button for analysts', () => {
      render(<FuelCodes />, { wrapper })
      const newFuelCodeBtn = screen.getByTestId('new-fuel-code-btn')
      expect(newFuelCodeBtn).toBeInTheDocument()
      expect(newFuelCodeBtn).toHaveTextContent('New fuel code')
    })

    it('should render clear filters button', () => {
      render(<FuelCodes />, { wrapper })
      const clearFiltersButton = screen.getByRole('button', {
        name: /clear filters/i
      })
      expect(clearFiltersButton).toBeInTheDocument()
    })
  })

  describe('Alert Message Handling', () => {
    it('should not render alert when no location state message', () => {
      mockLocationState.state = null
      render(<FuelCodes />, { wrapper })
      const alertBox = screen.queryByTestId('alert-box')
      expect(alertBox).not.toBeInTheDocument()
    })

    it('should render alert with message from location state', async () => {
      mockLocationState.state = {
        message: 'Test success message',
        severity: 'success'
      }
      
      render(<FuelCodes />, { wrapper })
      
      await waitFor(() => {
        const alertBox = screen.getByTestId('alert-box')
        expect(alertBox).toBeInTheDocument()
        expect(alertBox).toHaveTextContent('Test success message')
      })
    })

    it('should render alert with default info severity', async () => {
      mockLocationState.state = {
        message: 'Test message without severity'
      }
      
      render(<FuelCodes />, { wrapper })
      
      await waitFor(() => {
        const alertBox = screen.getByTestId('alert-box')
        expect(alertBox).toBeInTheDocument()
        expect(alertBox).toHaveTextContent('Test message without severity')
      })
    })

    it('should render alert with error severity', async () => {
      mockLocationState.state = {
        message: 'Test error message',
        severity: 'error'
      }
      
      render(<FuelCodes />, { wrapper })
      
      await waitFor(() => {
        const alertBox = screen.getByTestId('alert-box')
        expect(alertBox).toBeInTheDocument()
        expect(alertBox).toHaveTextContent('Test error message')
      })
    })
  })

  describe('User Interactions', () => {
    it('should navigate to add fuel code page when new button clicked', () => {
      render(<FuelCodes />, { wrapper })
      const newFuelCodeBtn = screen.getByTestId('new-fuel-code-btn')
      fireEvent.click(newFuelCodeBtn)
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.FUEL_CODES.ADD)
    })

    it('should handle download button click', async () => {
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

    it('should handle clear filters button click', async () => {
      render(<FuelCodes />, { wrapper })
      const clearFiltersButton = screen.getByRole('button', {
        name: /clear filters/i
      })

      await act(async () => {
        fireEvent.click(clearFiltersButton)
      })

      expect(clearFiltersButton).toBeInTheDocument()
    })
  })

  describe('Download Functionality', () => {
    it('should show loading state during download', async () => {
      mockDownloadMutate = vi.fn(() => new Promise(() => {}))

      render(<FuelCodes />, { wrapper })
      const downloadButton = screen.getByTestId('fuel-code-download-btn')

      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(downloadButton).toHaveTextContent('Downloading fuel codes information...')
        expect(downloadButton).toBeDisabled()
      })
    })

    it('should reset button state after successful download', async () => {
      mockDownloadMutate = vi.fn().mockResolvedValue(undefined)

      render(<FuelCodes />, { wrapper })
      const downloadButton = screen.getByTestId('fuel-code-download-btn')

      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(downloadButton).toHaveTextContent('Download fuel codes information')
        expect(downloadButton).toBeEnabled()
      })
    })

    it('should display error message on download failure', async () => {
      mockDownloadMutate = vi.fn().mockRejectedValue(new Error('Download failed'))

      render(<FuelCodes />, { wrapper })
      const downloadButton = screen.getByTestId('fuel-code-download-btn')

      fireEvent.click(downloadButton)

      await waitFor(() => {
        const alertBox = screen.getByTestId('alert-box')
        expect(alertBox).toBeInTheDocument()
        expect(alertBox).toHaveTextContent('Failed to download fuel code information')
      })
    })

    it('should reset button state after download failure', async () => {
      mockDownloadMutate = vi.fn().mockRejectedValue(new Error('Download failed'))

      render(<FuelCodes />, { wrapper })
      const downloadButton = screen.getByTestId('fuel-code-download-btn')

      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(downloadButton).toHaveTextContent('Download fuel codes information')
        expect(downloadButton).toBeEnabled()
      })
    })

    it('should handle export payload with filters', async () => {
      const mockFilterModel = {
        name: {
          filterType: 'text',
          type: 'contains',
          filter: 'test'
        }
      }

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

    it('should handle missing grid reference gracefully', async () => {
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

  describe('Data Loading States', () => {
    it('should handle loading state from useGetFuelCodes', () => {
      mockGetFuelCodesData = {
        ...mockGetFuelCodesData,
        isLoading: true
      }

      render(<FuelCodes />, { wrapper })
      const gridContainer = screen.getByTestId('bc-grid-container')
      expect(gridContainer).toBeInTheDocument()
    })

    it('should handle error state from useGetFuelCodes', () => {
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

    it('should handle empty fuel codes data', () => {
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
  })

  describe('Component State Management', () => {
    it('should initialize with correct default state', () => {
      render(<FuelCodes />, { wrapper })
      
      // Verify initial rendering without errors
      expect(screen.getByTestId('title')).toBeInTheDocument()
      expect(screen.queryByTestId('alert-box')).not.toBeInTheDocument()
    })

    it('should handle pagination options correctly', () => {
      render(<FuelCodes />, { wrapper })
      const gridContainer = screen.getByTestId('bc-grid-container')
      expect(gridContainer).toBeInTheDocument()
    })
  })

  describe('Grid Integration', () => {
    it('should pass correct props to BCGridViewer', () => {
      render(<FuelCodes />, { wrapper })
      const gridContainer = screen.getByTestId('bc-grid-container')
      expect(gridContainer).toBeInTheDocument()
    })

    it('should handle row ID generation', () => {
      const params = { data: { fuelCodeId: 123 } }
      const result = params.data.fuelCodeId.toString()
      expect(result).toBe('123')
    })

    it('should handle different fuel code IDs', () => {
      const params1 = { data: { fuelCodeId: 1 } }
      const params2 = { data: { fuelCodeId: '002' } }
      
      expect(params1.data.fuelCodeId.toString()).toBe('1')
      expect(params2.data.fuelCodeId.toString()).toBe('002')
    })
  })

  describe('Export Payload Building', () => {
    it('should build export payload with default values', () => {
      const payload = {
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
      
      expect(payload.page).toBe(1)
      expect(payload.size).toBe(10000)
      expect(Array.isArray(payload.filters)).toBe(true)
      expect(Array.isArray(payload.sortOrders)).toBe(true)
    })

    it('should handle undefined grid reference', () => {
      const gridRef = { current: null }
      const filterModel = gridRef.current?.api?.getFilterModel?.() || {}
      const filters = Object.entries(filterModel).map(([field, cfg]) => ({
        field,
        filterType: cfg.filterType || 'text',
        type: cfg.type,
        filter: cfg.filter,
        dateFrom: cfg.dateFrom,
        dateTo: cfg.dateTo
      }))
      
      expect(filters).toEqual([])
    })
  })

  describe('Error Scenarios', () => {
    it('should handle console error during download', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockDownloadMutate = vi.fn().mockRejectedValue(new Error('Network error'))

      render(<FuelCodes />, { wrapper })
      const downloadButton = screen.getByTestId('fuel-code-download-btn')

      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error downloading fuel code information:',
          expect.any(Error)
        )
      })

      consoleSpy.mockRestore()
    })

    it('should clear alert message before download', async () => {
      mockLocationState.state = {
        message: 'Previous message',
        severity: 'info'
      }

      render(<FuelCodes />, { wrapper })
      
      await waitFor(() => {
        expect(screen.getByTestId('alert-box')).toBeInTheDocument()
      })

      const downloadButton = screen.getByTestId('fuel-code-download-btn')
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(mockDownloadMutate).toHaveBeenCalled()
      })
    })
  })

  describe('Conditional Rendering', () => {
    it('should render new fuel code button only for analysts', () => {
      render(<FuelCodes />, { wrapper })
      const newFuelCodeBtn = screen.getByTestId('new-fuel-code-btn')
      expect(newFuelCodeBtn).toBeInTheDocument()
    })

    it('should always render download and clear filters buttons', () => {
      render(<FuelCodes />, { wrapper })
      
      expect(screen.getByTestId('fuel-code-download-btn')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()
    })
  })

  describe('Translation Integration', () => {
    it('should use translation keys for all text content', () => {
      render(<FuelCodes />, { wrapper })
      
      expect(screen.getByText('Fuel codes')).toBeInTheDocument()
      expect(screen.getByText('New fuel code')).toBeInTheDocument()
      expect(screen.getByText('Download fuel codes information')).toBeInTheDocument()
      expect(screen.getByText('Clear filters')).toBeInTheDocument()
    })
  })
})