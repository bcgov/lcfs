import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
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

// Using the standard test wrapper from utils

describe('useFuelExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useFuelExportOptions', () => {
    it('should fetch fuel export options successfully', async () => {
      const mockOptions = {
        fuelTypes: ['Gasoline', 'Diesel'],
        destinations: ['USA', 'Canada']
      }
      mockApiService.get.mockResolvedValue({ data: mockOptions })

      const { result } = renderHook(
        () => useFuelExportOptions({ compliancePeriod: 2024 }),
        { wrapper: wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockOptions)
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/fuel-exports/table-options?compliancePeriod=2024'
      )
    })

    it('should not fetch when compliancePeriod is missing', () => {
      const { result } = renderHook(() => useFuelExportOptions({}), {
        wrapper: wrapper
      })

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle enabled option', () => {
      const { result } = renderHook(
        () =>
          useFuelExportOptions({ compliancePeriod: 2024 }, { enabled: false }),
        { wrapper: wrapper }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      const mockError = new Error('API Error')
      mockApiService.get.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useFuelExportOptions({ compliancePeriod: 2024 }, { retry: 0 }),
        { wrapper: wrapper }
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useGetFuelExports', () => {
    it('should fetch fuel exports with string params successfully', async () => {
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
        { wrapper: wrapper }
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

    it('should fetch fuel exports with object params successfully', async () => {
      const mockExports = {
        fuelExports: [{ id: 1, fuelType: 'Gasoline' }],
        pagination: { total: 1, page: 1 }
      }
      mockApiService.post.mockResolvedValue({ data: mockExports })

      const params = { complianceReportId: 123, fuelType: 'Gasoline' }
      const pagination = { page: 1, size: 10 }
      const { result } = renderHook(
        () => useGetFuelExports(params, pagination),
        { wrapper: wrapper }
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

    it('should not fetch when params is missing', () => {
      const { result } = renderHook(
        () => useGetFuelExports(null, { page: 1, size: 10 }),
        { wrapper: wrapper }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })

    it('should handle enabled option', () => {
      const { result } = renderHook(
        () =>
          useGetFuelExports('123', { page: 1, size: 10 }, { enabled: false }),
        { wrapper: wrapper }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useGetFuelExportsList', () => {
    it('should fetch fuel exports list successfully', async () => {
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
        { wrapper: wrapper }
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

    it('should fetch fuel exports list with changelog', async () => {
      const mockExports = { fuelExports: [], pagination: { total: 0, page: 1 } }
      mockApiService.post.mockResolvedValue({ data: mockExports })

      const pagination = { page: 1, size: 10 }
      const { result } = renderHook(
        () =>
          useGetFuelExportsList(
            { complianceReportId: 123, changelog: true },
            pagination
          ),
        { wrapper: wrapper }
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

    it('should not fetch when complianceReportId is missing', () => {
      const { result } = renderHook(
        () => useGetFuelExportsList({}, { page: 1, size: 10 }),
        { wrapper: wrapper }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useSaveFuelExport', () => {
    it('should save fuel export successfully', async () => {
      const mockResponse = { data: { id: 1, fuelType: 'Gasoline' } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useSaveFuelExport({ complianceReportId: 123 }),
        { wrapper: wrapper }
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

    it('should handle save errors', async () => {
      const mockError = new Error('Save failed')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useSaveFuelExport({ complianceReportId: 123 }),
        { wrapper: wrapper }
      )

      result.current.mutate({ fuelType: 'Gasoline' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useUpdateFuelExport', () => {
    it('should update fuel export successfully', async () => {
      const mockResponse = { data: { id: 1, fuelType: 'Updated Gasoline' } }
      mockApiService.put.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useUpdateFuelExport({ complianceReportId: 123 }),
        { wrapper: wrapper }
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

    it('should handle update errors', async () => {
      const mockError = new Error('Update failed')
      mockApiService.put.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useUpdateFuelExport({ complianceReportId: 123 }),
        { wrapper: wrapper }
      )

      result.current.mutate({ id: 1, fuelType: 'Gasoline' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useDeleteFuelExport', () => {
    it('should delete fuel export successfully', async () => {
      mockApiService.delete.mockResolvedValue({ data: {} })

      const { result } = renderHook(
        () => useDeleteFuelExport({ complianceReportId: 123 }),
        { wrapper: wrapper }
      )

      result.current.mutate(1)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.delete).toHaveBeenCalledWith('/fuel-exports/1')
    })

    it('should handle delete errors', async () => {
      const mockError = new Error('Delete failed')
      mockApiService.delete.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useDeleteFuelExport({ complianceReportId: 123 }),
        { wrapper: wrapper }
      )

      result.current.mutate(1)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useImportFuelExports', () => {
    it('should import fuel exports successfully', async () => {
      const mockResponse = { data: { jobId: 'job-123', status: 'started' } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useImportFuelExports(123), {
        wrapper: wrapper
      })

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

    it('should handle import errors', async () => {
      const mockError = new Error('File is required for import')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(() => useImportFuelExports(123), {
        wrapper: wrapper
      })

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
