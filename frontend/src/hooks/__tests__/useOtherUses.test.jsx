import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import {
  useOtherUsesOptions,
  useGetAllOtherUses,
  useGetAllOtherUsesList,
  useGetOtherUses,
  useSaveOtherUses,
  useUpdateOtherUses,
  useDeleteOtherUses,
  useImportOtherUses
} from '../useOtherUses'

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
    otherUsesOptions: '/other-uses/table-options?',
    getAllOtherUses: '/other-uses/list',
    getOtherUses: '/other-uses/filtered',
    saveOtherUses: '/other-uses',
    importOtherUses: '/other-uses/import'
  }
}))

// Using the standard test wrapper from utils

describe('useOtherUses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useOtherUsesOptions', () => {
    it('should fetch other uses options successfully', async () => {
      const mockOptions = {
        useTypes: ['Type A', 'Type B'],
        categories: ['Category 1', 'Category 2']
      }
      mockApiService.get.mockResolvedValue({ data: mockOptions })

      const { result } = renderHook(
        () => useOtherUsesOptions({ compliancePeriod: 2024 }),
        { wrapper: wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockOptions)
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/other-uses/table-options?compliancePeriod=2024'
      )
    })

    it('should not fetch when compliancePeriod is missing', () => {
      const { result } = renderHook(() => useOtherUsesOptions({}), {
        wrapper: wrapper
      })

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle enabled option', () => {
      const { result } = renderHook(
        () =>
          useOtherUsesOptions({ compliancePeriod: 2024 }, { enabled: false }),
        { wrapper: wrapper }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      const mockError = new Error('API Error')
      mockApiService.get.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useOtherUsesOptions({ compliancePeriod: 2024 }, { retry: 0 }),
        { wrapper: wrapper }
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useGetAllOtherUses', () => {
    it('should fetch all other uses successfully', async () => {
      const mockOtherUses = {
        otherUses: [
          { id: 1, useType: 'Type A' },
          { id: 2, useType: 'Type B' }
        ],
        pagination: { total: 2, page: 1 }
      }
      mockApiService.post.mockResolvedValue({ data: mockOtherUses })

      const pagination = { page: 1, size: 10 }
      const { result } = renderHook(() => useGetAllOtherUses(123, pagination), {
        wrapper: wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockOtherUses)
      expect(mockApiService.post).toHaveBeenCalledWith('/other-uses/list', {
        complianceReportId: 123,
        ...pagination
      })
    })

    it('should not fetch when complianceReportId is missing', () => {
      const { result } = renderHook(
        () => useGetAllOtherUses(null, { page: 1, size: 10 }),
        { wrapper: wrapper }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })

    it('should handle enabled option', () => {
      const { result } = renderHook(
        () =>
          useGetAllOtherUses(123, { page: 1, size: 10 }, { enabled: false }),
        { wrapper: wrapper }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useGetAllOtherUsesList', () => {
    it('should fetch other uses list successfully', async () => {
      const mockOtherUses = {
        otherUses: [
          { id: 1, useType: 'Type A' },
          { id: 2, useType: 'Type B' }
        ]
      }
      mockApiService.post.mockResolvedValue({ data: mockOtherUses })

      const { result } = renderHook(
        () => useGetAllOtherUsesList({ complianceReportId: 123 }),
        { wrapper: wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockOtherUses.otherUses)
      expect(mockApiService.post).toHaveBeenCalledWith('/other-uses/list', {
        complianceReportId: 123,
        changelog: false
      })
    })

    it('should fetch other uses list with changelog', async () => {
      const mockOtherUses = { otherUses: [] }
      mockApiService.post.mockResolvedValue({ data: mockOtherUses })

      const { result } = renderHook(
        () =>
          useGetAllOtherUsesList({ complianceReportId: 123, changelog: true }),
        { wrapper: wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith('/other-uses/list', {
        complianceReportId: 123,
        changelog: true
      })
    })

    it('should handle data without otherUses property', async () => {
      const mockData = [{ id: 1, useType: 'Type A' }]
      mockApiService.post.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useGetAllOtherUsesList({ complianceReportId: 123 }),
        { wrapper: wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
    })

    it('should not fetch when complianceReportId is missing', () => {
      const { result } = renderHook(() => useGetAllOtherUsesList({}), {
        wrapper: wrapper
      })

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useGetOtherUses', () => {
    it('should fetch filtered other uses successfully', async () => {
      const mockOtherUses = {
        otherUses: [{ id: 1, useType: 'Type A' }],
        pagination: { total: 1, page: 1 }
      }
      mockApiService.post.mockResolvedValue({ data: mockOtherUses })

      const params = {
        page: 1,
        size: 10,
        sortOrders: [{ field: 'id', direction: 'desc' }],
        filters: [{ field: 'useType', value: 'Type A' }],
        complianceReportId: 123
      }

      const { result } = renderHook(() => useGetOtherUses(params), {
        wrapper: wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockOtherUses)
      expect(mockApiService.post).toHaveBeenCalledWith(
        '/other-uses/filtered',
        params
      )
    })

    it('should not fetch when complianceReportId is missing', () => {
      const { result } = renderHook(
        () => useGetOtherUses({ page: 1, size: 10 }),
        { wrapper: wrapper }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useSaveOtherUses', () => {
    it('should save other uses successfully', async () => {
      const mockResponse = { data: { id: 1, useType: 'Type A' } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useSaveOtherUses(123), {
        wrapper: wrapper
      })

      const otherUsesData = {
        useType: 'Type A',
        quantity: 1000
      }

      result.current.mutate(otherUsesData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith('/other-uses', {
        complianceReportId: 123,
        ...otherUsesData
      })
    })

    it('should handle save errors', async () => {
      const mockError = new Error('Save failed')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(() => useSaveOtherUses(123), {
        wrapper: wrapper
      })

      result.current.mutate({ useType: 'Type A' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useUpdateOtherUses', () => {
    it('should update other uses successfully', async () => {
      const mockResponse = { data: { id: 1, useType: 'Updated Type' } }
      mockApiService.put.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useUpdateOtherUses(123), {
        wrapper: wrapper
      })

      const otherUsesData = {
        id: 1,
        useType: 'Updated Type',
        quantity: 1500
      }

      result.current.mutate(otherUsesData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.put).toHaveBeenCalledWith('/other-uses/1', {
        complianceReportId: 123,
        ...otherUsesData
      })
    })

    it('should handle update errors', async () => {
      const mockError = new Error('Update failed')
      mockApiService.put.mockRejectedValue(mockError)

      const { result } = renderHook(() => useUpdateOtherUses(123), {
        wrapper: wrapper
      })

      result.current.mutate({ id: 1, useType: 'Type A' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useDeleteOtherUses', () => {
    it('should delete other uses successfully', async () => {
      mockApiService.delete.mockResolvedValue({ data: {} })

      const { result } = renderHook(() => useDeleteOtherUses(123), {
        wrapper: wrapper
      })

      result.current.mutate(1)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.delete).toHaveBeenCalledWith('/other-uses/1')
    })

    it('should handle delete errors', async () => {
      const mockError = new Error('Delete failed')
      mockApiService.delete.mockRejectedValue(mockError)

      const { result } = renderHook(() => useDeleteOtherUses(123), {
        wrapper: wrapper
      })

      result.current.mutate(1)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useImportOtherUses', () => {
    it('should import other uses successfully', async () => {
      const mockResponse = { data: { jobId: 'job-123', status: 'started' } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useImportOtherUses(123), {
        wrapper: wrapper
      })

      const file = new File(['csv content'], 'other-uses.csv', {
        type: 'text/csv'
      })
      result.current.mutate({ file })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/other-uses/import',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      )
    })

    it('should handle import errors', async () => {
      const mockError = new Error('Import failed')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(() => useImportOtherUses(123), {
        wrapper: wrapper
      })

      const file = new File(['csv content'], 'other-uses.csv', {
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
