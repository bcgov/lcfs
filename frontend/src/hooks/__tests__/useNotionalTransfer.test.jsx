import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import {
  useNotionalTransferOptions,
  useGetAllNotionalTransfers,
  useGetAllNotionalTransfersList,
  useGetNotionalTransfers,
  useSaveNotionalTransfer,
  useUpdateNotionalTransfer,
  useDeleteNotionalTransfer,
  useImportNotionalTransfers
} from '../useNotionalTransfer'

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
    notionalTransferOptions: '/notional-transfers/options',
    getAllNotionalTransfers: '/notional-transfers/list',
    getNotionalTransfers: '/notional-transfers/filtered',
    saveNotionalTransfer: '/notional-transfers',
    importNotionalTransfers: '/notional-transfers/import'
  }
}))

// Using the standard test wrapper from utils

describe('useNotionalTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useNotionalTransferOptions', () => {
    it('should fetch notional transfer options successfully', async () => {
      const mockOptions = {
        transferTypes: ['Type A', 'Type B'],
        categories: ['Category 1', 'Category 2']
      }
      mockApiService.get.mockResolvedValue({ data: mockOptions })

      const { result } = renderHook(() => useNotionalTransferOptions(), {
        wrapper: wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockOptions)
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/notional-transfers/options'
      )
    })

    it('should handle enabled option', () => {
      const { result } = renderHook(
        () => useNotionalTransferOptions({}, { enabled: false }),
        { wrapper: wrapper }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      const mockError = new Error('API Error')
      mockApiService.get.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useNotionalTransferOptions({}, { retry: 0 }),
        {
          wrapper: wrapper
        }
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useGetAllNotionalTransfers', () => {
    it('should fetch all notional transfers successfully', async () => {
      const mockTransfers = {
        notionalTransfers: [
          { id: 1, transferType: 'Type A' },
          { id: 2, transferType: 'Type B' }
        ],
        pagination: { total: 2, page: 1 }
      }
      mockApiService.post.mockResolvedValue({ data: mockTransfers })

      const pagination = { page: 1, size: 10 }
      const { result } = renderHook(
        () => useGetAllNotionalTransfers(123, pagination),
        { wrapper: wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockTransfers)
      expect(mockApiService.post).toHaveBeenCalledWith(
        '/notional-transfers/list',
        { complianceReportId: 123, ...pagination }
      )
    })

    it('should not fetch when complianceReportId is missing', () => {
      const { result } = renderHook(
        () => useGetAllNotionalTransfers(null, { page: 1, size: 10 }),
        { wrapper: wrapper }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })

    it('should handle enabled option', () => {
      const { result } = renderHook(
        () =>
          useGetAllNotionalTransfers(
            123,
            { page: 1, size: 10 },
            { enabled: false }
          ),
        { wrapper: wrapper }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useGetAllNotionalTransfersList', () => {
    it('should fetch notional transfers list successfully', async () => {
      const mockTransfers = {
        notionalTransfers: [
          { id: 1, transferType: 'Type A' },
          { id: 2, transferType: 'Type B' }
        ]
      }
      mockApiService.post.mockResolvedValue({ data: mockTransfers })

      const { result } = renderHook(
        () => useGetAllNotionalTransfersList({ complianceReportId: 123 }),
        { wrapper: wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockTransfers.notionalTransfers)
      expect(mockApiService.post).toHaveBeenCalledWith(
        '/notional-transfers/list',
        { complianceReportId: 123, changelog: false }
      )
    })

    it('should fetch notional transfers list with changelog', async () => {
      const mockTransfers = { notionalTransfers: [] }
      mockApiService.post.mockResolvedValue({ data: mockTransfers })

      const { result } = renderHook(
        () =>
          useGetAllNotionalTransfersList({
            complianceReportId: 123,
            changelog: true
          }),
        { wrapper: wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/notional-transfers/list',
        { complianceReportId: 123, changelog: true }
      )
    })

    it('should handle data without notionalTransfers property', async () => {
      const mockData = [{ id: 1, transferType: 'Type A' }]
      mockApiService.post.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useGetAllNotionalTransfersList({ complianceReportId: 123 }),
        { wrapper: wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
    })

    it('should not fetch when complianceReportId is missing', () => {
      const { result } = renderHook(() => useGetAllNotionalTransfersList({}), {
        wrapper: wrapper
      })

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useGetNotionalTransfers', () => {
    it('should fetch filtered notional transfers successfully', async () => {
      const mockTransfers = {
        notionalTransfers: [{ id: 1, transferType: 'Type A' }],
        pagination: { total: 1, page: 1 }
      }
      mockApiService.post.mockResolvedValue({ data: mockTransfers })

      const params = {
        page: 1,
        size: 10,
        sortOrders: [{ field: 'id', direction: 'desc' }],
        filters: [{ field: 'transferType', value: 'Type A' }],
        complianceReportId: 123
      }

      const { result } = renderHook(() => useGetNotionalTransfers(params), {
        wrapper: wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockTransfers)
      expect(mockApiService.post).toHaveBeenCalledWith(
        '/notional-transfers/filtered',
        params
      )
    })

    it('should not fetch when complianceReportId is missing', () => {
      const { result } = renderHook(
        () => useGetNotionalTransfers({ page: 1, size: 10 }),
        { wrapper: wrapper }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useSaveNotionalTransfer', () => {
    it('should save notional transfer successfully', async () => {
      const mockResponse = { data: { id: 1, transferType: 'Type A' } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useSaveNotionalTransfer(123), {
        wrapper: wrapper
      })

      const transferData = {
        transferType: 'Type A',
        quantity: 1000
      }

      result.current.mutate(transferData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith('/notional-transfers', {
        complianceReportId: 123,
        ...transferData
      })
    })

    it('should handle save errors', async () => {
      const mockError = new Error('Save failed')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(() => useSaveNotionalTransfer(123), {
        wrapper: wrapper
      })

      result.current.mutate({ transferType: 'Type A' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useUpdateNotionalTransfer', () => {
    it('should update notional transfer successfully', async () => {
      const mockResponse = { data: { id: 1, transferType: 'Updated Type' } }
      mockApiService.put.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useUpdateNotionalTransfer(123), {
        wrapper: wrapper
      })

      const transferData = {
        id: 1,
        transferType: 'Updated Type',
        quantity: 1500
      }

      result.current.mutate(transferData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.put).toHaveBeenCalledWith('/notional-transfers/1', {
        complianceReportId: 123,
        ...transferData
      })
    })

    it('should handle update errors', async () => {
      const mockError = new Error('Update failed')
      mockApiService.put.mockRejectedValue(mockError)

      const { result } = renderHook(() => useUpdateNotionalTransfer(123), {
        wrapper: wrapper
      })

      result.current.mutate({ id: 1, transferType: 'Type A' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useDeleteNotionalTransfer', () => {
    it('should delete notional transfer successfully', async () => {
      mockApiService.delete.mockResolvedValue({ data: {} })

      const { result } = renderHook(() => useDeleteNotionalTransfer(123), {
        wrapper: wrapper
      })

      result.current.mutate(1)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.delete).toHaveBeenCalledWith(
        '/notional-transfers/1'
      )
    })

    it('should handle delete errors', async () => {
      const mockError = new Error('Delete failed')
      mockApiService.delete.mockRejectedValue(mockError)

      const { result } = renderHook(() => useDeleteNotionalTransfer(123), {
        wrapper: wrapper
      })

      result.current.mutate(1)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useImportNotionalTransfers', () => {
    it('should import notional transfers successfully', async () => {
      const mockResponse = { data: { jobId: 'job-123', status: 'started' } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useImportNotionalTransfers(123), {
        wrapper: wrapper
      })

      const file = new File(['csv content'], 'transfers.csv', {
        type: 'text/csv'
      })
      result.current.mutate({ file })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/notional-transfers/import',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      )
    })

    it('should handle import errors', async () => {
      const mockError = new Error('File is required for import')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(() => useImportNotionalTransfers(123), {
        wrapper: wrapper
      })

      const file = new File(['csv content'], 'transfers.csv', {
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
