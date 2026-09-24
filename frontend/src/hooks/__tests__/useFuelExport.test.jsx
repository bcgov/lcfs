import { waitFor } from '@testing-library/react'
import { vi, describe, expect, beforeEach } from 'vitest'
import { test } from '@/tests/utils/fixtures'
import {
  useFuelExportOptions,
  useGetFuelExports,
  useGetFuelExportsList,
  useSaveFuelExport,
  useUpdateFuelExport,
  useDeleteFuelExport,
  useImportFuelExports
} from '../useFuelExport'

// Mock the API service
const mockApiService = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}

vi.mock('@/services/useApiService', () => ({
  useApiService: () => mockApiService
}))

vi.mock('@/constants/routes', () => ({
  apiRoutes: {
    fuelExportOptions: '/fuel-exports/table-options?',
    getAllFuelExports: '/fuel-exports/list',
    saveFuelExports: '/fuel-exports',
    importFuelExports: '/fuel-exports/import'
  }
}))

// Using the native test fixtures from utils

describe('useFuelExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useFuelExportOptions', () => {
    test('should fetch fuel export options successfully', async ({
      renderHook,
      query
    }) => {
      const mockOptions = {
        fuelTypes: ['Gasoline', 'Diesel'],
        destinations: ['USA', 'Canada']
      }
      mockApiService.get.mockResolvedValue({ data: mockOptions })

      const { result } = renderHook(
        () => useFuelExportOptions({ compliancePeriod: 2024 }),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockOptions)
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/fuel-exports/table-options?compliancePeriod=2024'
      )
    })

    test('should not fetch when compliancePeriod is missing', ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(() => useFuelExportOptions({}), [query])

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    test('should handle enabled option', ({ renderHook, query }) => {
      const { result } = renderHook(
        () =>
          useFuelExportOptions({ compliancePeriod: 2024 }, { enabled: false }),
        [query]
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    test('should handle API errors', async ({ renderHook, query }) => {
      const mockError = new Error('API Error')
      mockApiService.get.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useFuelExportOptions({ compliancePeriod: 2024 }, { retry: 0 }),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useGetFuelExports', () => {
    test('should fetch fuel exports with string params successfully', async ({
      renderHook,
      query
    }) => {
      const mockExports = {
        fuelExports: [
          { id: 1, fuelType: 'Gasoline' },
          { id: 2, fuelType: 'Diesel' }
        ],
        pagination: { total: 2, page: 1 }
      }
      mockApiService.post.mockResolvedValue({ data: mockExports })

      const pagination = { page: 1, size: 10 }
      const { result } = renderHook(
        () => useGetFuelExports('123', pagination),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockExports)
      expect(mockApiService.post).toHaveBeenCalledWith('/fuel-exports/list', {
        complianceReportId: '123',
        ...pagination
      })
    })

    test('should fetch fuel exports with object params successfully', async ({
      renderHook,
      query
    }) => {
      const mockExports = {
        fuelExports: [{ id: 1, fuelType: 'Gasoline' }],
        pagination: { total: 1, page: 1 }
      }
      mockApiService.post.mockResolvedValue({ data: mockExports })

      const params = { complianceReportId: 123, fuelType: 'Gasoline' }
      const pagination = { page: 1, size: 10 }
      const { result } = renderHook(
        () => useGetFuelExports(params, pagination),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockExports)
      expect(mockApiService.post).toHaveBeenCalledWith('/fuel-exports/list', {
        ...params,
        ...pagination
      })
    })

    test('should not fetch when params is missing', ({ renderHook, query }) => {
      const { result } = renderHook(
        () => useGetFuelExports(null, { page: 1, size: 10 }),
        [query]
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })

    test('should handle enabled option', ({ renderHook, query }) => {
      const { result } = renderHook(
        () =>
          useGetFuelExports('123', { page: 1, size: 10 }, { enabled: false }),
        [query]
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useGetFuelExportsList', () => {
    test('should fetch fuel exports list successfully', async ({
      renderHook,
      query
    }) => {
      const mockExports = {
        fuelExports: [
          { id: 1, fuelType: 'Gasoline' },
          { id: 2, fuelType: 'Diesel' }
        ],
        pagination: { total: 2, page: 1 }
      }
      mockApiService.post.mockResolvedValue({ data: mockExports })

      const pagination = { page: 1, size: 10 }
      const { result } = renderHook(
        () => useGetFuelExportsList({ complianceReportId: 123 }, pagination),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockExports)
      expect(mockApiService.post).toHaveBeenCalledWith('/fuel-exports/list', {
        complianceReportId: 123,
        changelog: false,
        ...pagination
      })
    })

    test('should fetch fuel exports list with changelog', async ({
      renderHook,
      query
    }) => {
      const mockExports = { fuelExports: [], pagination: { total: 0, page: 1 } }
      mockApiService.post.mockResolvedValue({ data: mockExports })

      const pagination = { page: 1, size: 10 }
      const { result } = renderHook(
        () =>
          useGetFuelExportsList(
            { complianceReportId: 123, changelog: true },
            pagination
          ),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith('/fuel-exports/list', {
        complianceReportId: 123,
        changelog: true,
        ...pagination
      })
    })

    test('should not fetch when complianceReportId is missing', ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(
        () => useGetFuelExportsList({}, { page: 1, size: 10 }),
        [query]
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useSaveFuelExport', () => {
    test('should save fuel export successfully', async ({
      renderHook,
      query
    }) => {
      const mockResponse = { data: { id: 1, fuelType: 'Gasoline' } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useSaveFuelExport({ complianceReportId: 123 }),
        [query]
      )

      const exportData = {
        fuelType: 'Gasoline',
        quantity: 1000
      }

      result.current.mutate(exportData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith('/fuel-exports', {
        complianceReportId: 123,
        ...exportData
      })
    })

    test('should handle save errors', async ({ renderHook, query }) => {
      const mockError = new Error('Save failed')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useSaveFuelExport({ complianceReportId: 123 }),
        [query]
      )

      result.current.mutate({ fuelType: 'Gasoline' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useUpdateFuelExport', () => {
    test('should update fuel export successfully', async ({
      renderHook,
      query
    }) => {
      const mockResponse = { data: { id: 1, fuelType: 'Updated Gasoline' } }
      mockApiService.put.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useUpdateFuelExport({ complianceReportId: 123 }),
        [query]
      )

      const exportData = {
        id: 1,
        fuelType: 'Updated Gasoline',
        quantity: 1500
      }

      result.current.mutate(exportData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.put).toHaveBeenCalledWith('/fuel-exports/1', {
        complianceReportId: 123,
        ...exportData
      })
    })

    test('should handle update errors', async ({ renderHook, query }) => {
      const mockError = new Error('Update failed')
      mockApiService.put.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useUpdateFuelExport({ complianceReportId: 123 }),
        [query]
      )

      result.current.mutate({ id: 1, fuelType: 'Gasoline' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useDeleteFuelExport', () => {
    test('should delete fuel export successfully', async ({
      renderHook,
      query
    }) => {
      mockApiService.delete.mockResolvedValue({ data: {} })

      const { result } = renderHook(
        () => useDeleteFuelExport({ complianceReportId: 123 }),
        [query]
      )

      result.current.mutate(1)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.delete).toHaveBeenCalledWith('/fuel-exports/1')
    })

    test('should handle delete errors', async ({ renderHook, query }) => {
      const mockError = new Error('Delete failed')
      mockApiService.delete.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useDeleteFuelExport({ complianceReportId: 123 }),
        [query]
      )

      result.current.mutate(1)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useImportFuelExports', () => {
    test('should import fuel exports successfully', async ({
      renderHook,
      query
    }) => {
      const mockResponse = { data: { jobId: 'job-123', status: 'started' } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useImportFuelExports(123), [query])

      const file = new File(['csv content'], 'exports.csv', {
        type: 'text/csv'
      })
      result.current.mutate({ file })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/fuel-exports/import',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      )
    })

    test('should handle import errors', async ({ renderHook, query }) => {
      const mockError = new Error('File is required for import')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(() => useImportFuelExports(123), [query])

      const file = new File(['csv content'], 'exports.csv', {
        type: 'text/csv'
      })
      result.current.mutate({ file })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })
})
