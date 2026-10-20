import { waitFor } from '@testing-library/react'
import { vi, describe, expect, beforeEach } from 'vitest'
import { test } from '@/tests/utils/fixtures'
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

// Using the native test fixtures from utils

describe('useNotionalTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useNotionalTransferOptions', () => {
    test('should fetch notional transfer options successfully', async ({
      renderHook,
      query
    }) => {
      const mockOptions = {
        transferTypes: ['Type A', 'Type B'],
        categories: ['Category 1', 'Category 2']
      }
      mockApiService.get.mockResolvedValue({ data: mockOptions })

      const { result } = renderHook(() => useNotionalTransferOptions(), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockOptions)
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/notional-transfers/options'
      )
    })

    test('should handle enabled option', ({ renderHook, query }) => {
      const { result } = renderHook(
        () => useNotionalTransferOptions({}, { enabled: false }),
        [query]
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    test('should handle API errors', async ({ renderHook, query }) => {
      const mockError = new Error('API Error')
      mockApiService.get.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useNotionalTransferOptions({}, { retry: 0 }),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useGetAllNotionalTransfers', () => {
    test('should fetch all notional transfers successfully', async ({
      renderHook,
      query
    }) => {
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
        [query]
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

    test('should not fetch when complianceReportId is missing', ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(
        () => useGetAllNotionalTransfers(null, { page: 1, size: 10 }),
        [query]
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })

    test('should handle enabled option', ({ renderHook, query }) => {
      const { result } = renderHook(
        () =>
          useGetAllNotionalTransfers(
            123,
            { page: 1, size: 10 },
            { enabled: false }
          ),
        [query]
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useGetAllNotionalTransfersList', () => {
    test('should fetch notional transfers list successfully', async ({
      renderHook,
      query
    }) => {
      const mockTransfers = {
        notionalTransfers: [
          { id: 1, transferType: 'Type A' },
          { id: 2, transferType: 'Type B' }
        ]
      }
      mockApiService.post.mockResolvedValue({ data: mockTransfers })

      const { result } = renderHook(
        () => useGetAllNotionalTransfersList({ complianceReportId: 123 }),
        [query]
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

    test('should fetch notional transfers list with changelog', async ({
      renderHook,
      query
    }) => {
      const mockTransfers = { notionalTransfers: [] }
      mockApiService.post.mockResolvedValue({ data: mockTransfers })

      const { result } = renderHook(
        () =>
          useGetAllNotionalTransfersList({
            complianceReportId: 123,
            changelog: true
          }),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/notional-transfers/list',
        { complianceReportId: 123, changelog: true }
      )
    })

    test('should handle data without notionalTransfers property', async ({
      renderHook,
      query
    }) => {
      const mockData = [{ id: 1, transferType: 'Type A' }]
      mockApiService.post.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useGetAllNotionalTransfersList({ complianceReportId: 123 }),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
    })

    test('should not fetch when complianceReportId is missing', ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(
        () => useGetAllNotionalTransfersList({}),
        [query]
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useGetNotionalTransfers', () => {
    test('should fetch filtered notional transfers successfully', async ({
      renderHook,
      query
    }) => {
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

      const { result } = renderHook(
        () => useGetNotionalTransfers(params),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockTransfers)
      expect(mockApiService.post).toHaveBeenCalledWith(
        '/notional-transfers/filtered',
        params
      )
    })

    test('should not fetch when complianceReportId is missing', ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(
        () => useGetNotionalTransfers({ page: 1, size: 10 }),
        [query]
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useSaveNotionalTransfer', () => {
    test('should save notional transfer successfully', async ({
      renderHook,
      query
    }) => {
      const mockResponse = { data: { id: 1, transferType: 'Type A' } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useSaveNotionalTransfer(123), [query])

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

    test('should handle save errors', async ({ renderHook, query }) => {
      const mockError = new Error('Save failed')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(() => useSaveNotionalTransfer(123), [query])

      result.current.mutate({ transferType: 'Type A' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useUpdateNotionalTransfer', () => {
    test('should update notional transfer successfully', async ({
      renderHook,
      query
    }) => {
      const mockResponse = { data: { id: 1, transferType: 'Updated Type' } }
      mockApiService.put.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useUpdateNotionalTransfer(123),
        [query]
      )

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

    test('should handle update errors', async ({ renderHook, query }) => {
      const mockError = new Error('Update failed')
      mockApiService.put.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useUpdateNotionalTransfer(123),
        [query]
      )

      result.current.mutate({ id: 1, transferType: 'Type A' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useDeleteNotionalTransfer', () => {
    test('should delete notional transfer successfully', async ({
      renderHook,
      query
    }) => {
      mockApiService.delete.mockResolvedValue({ data: {} })

      const { result } = renderHook(
        () => useDeleteNotionalTransfer(123),
        [query]
      )

      result.current.mutate(1)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.delete).toHaveBeenCalledWith(
        '/notional-transfers/1'
      )
    })

    test('should handle delete errors', async ({ renderHook, query }) => {
      const mockError = new Error('Delete failed')
      mockApiService.delete.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useDeleteNotionalTransfer(123),
        [query]
      )

      result.current.mutate(1)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useImportNotionalTransfers', () => {
    test('should import notional transfers successfully', async ({
      renderHook,
      query
    }) => {
      const mockResponse = { data: { jobId: 'job-123', status: 'started' } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useImportNotionalTransfers(123),
        [query]
      )

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

    test('should handle import errors', async ({ renderHook, query }) => {
      const mockError = new Error('File is required for import')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useImportNotionalTransfers(123),
        [query]
      )

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
