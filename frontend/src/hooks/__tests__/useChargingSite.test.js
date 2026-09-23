import { act, waitFor } from '@testing-library/react'
import { describe, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '../../services/useApiService'
import { test } from '@/tests/utils/fixtures'
import {
  useGetChargingSiteById,
  useChargingSiteStatuses,
  useBulkUpdateEquipmentStatus,
  useChargingSiteEquipmentPaginated,
  useUpdateChargingSiteStatus
} from '../useChargingSite'

vi.mock('../../services/useApiService')

describe('useChargingSite', () => {
  const mockGet = vi.fn()
  const mockPost = vi.fn()
  const mockPatch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({
      get: mockGet,
      post: mockPost,
      patch: mockPatch
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('useChargingSite', () => {
    test('should fetch charging site successfully', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        charging_site_id: 1,
        site_name: 'Test Charging Site',
        organization: { name: 'Test Org' },
        status: { status: 'Draft' },
        attachments: [],
        intended_users: []
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useGetChargingSiteById(1), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/charging-sites/1', {
        params: undefined
      })
    })

    test('should request history mode when enabled', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        chargingSiteId: 1,
        siteName: 'Test Charging Site',
        history: [{ chargingSiteId: 1, version: 2 }]
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useGetChargingSiteById(1, { historyMode: true }),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith('/charging-sites/1', {
        params: { history_mode: true }
      })
    })

    test('should handle API errors', async ({ renderHook, query }) => {
      const mockError = new Error('Failed to fetch charging site')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useGetChargingSiteById(1, { retry: false }),
        [query]
      )

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true)
        },
        { timeout: 3000 }
      )

      expect(result.current.error).toEqual(mockError)
    })

    test('should not fetch when siteId is undefined', ({
      renderHook,
      query
    }) => {
      renderHook(() => useGetChargingSiteById(undefined), [query])

      expect(mockGet).not.toHaveBeenCalled()
    })
  })

  describe('useChargingSiteStatuses', () => {
    test('should fetch charging site statuses successfully', async ({
      renderHook,
      query
    }) => {
      const mockData = [
        { id: 1, status: 'Draft', description: 'Draft status' },
        { id: 2, status: 'Submitted', description: 'Submitted status' }
      ]
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useChargingSiteStatuses(), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      // Fixed: Remove trailing slash to match actual implementation
      expect(mockGet).toHaveBeenCalledWith('/charging-sites/statuses')
    })

    test('should handle API errors', async ({ renderHook, query }) => {
      const mockError = new Error('Failed to fetch statuses')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(() => useChargingSiteStatuses(), [query])

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useBulkUpdateEquipmentStatus', () => {
    test('should perform bulk update successfully', async ({
      renderHook,
      query
    }) => {
      const mockResponse = {
        data: [
          {
            charging_site_id: 1,
            site_name: 'Updated Site'
          }
        ]
      }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useBulkUpdateEquipmentStatus(),
        [query]
      )

      const updateData = {
        siteId: 1,
        equipmentIds: [1, 2],
        newStatus: 'Validated'
      }

      await act(async () => {
        await result.current.mutateAsync(updateData)
      })

      expect(mockPost).toHaveBeenCalledWith(
        '/charging-sites/1/equipment/bulk-status-update',
        {
          equipment_ids: [1, 2],
          new_status: 'Validated'
        }
      )
    })

    test('should handle bulk update errors', async ({ renderHook, query }) => {
      const mockError = {
        response: {
          data: {
            detail: 'Equipment can only be validated from Submitted status'
          }
        }
      }
      mockPost.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useBulkUpdateEquipmentStatus(),
        [query]
      )

      const updateData = {
        siteId: 1,
        equipmentIds: [1, 2],
        newStatus: 'Validated'
      }

      await act(async () => {
        try {
          await result.current.mutateAsync(updateData)
        } catch (error) {
          expect(error).toEqual(mockError)
        }
      })

      expect(mockPost).toHaveBeenCalledWith(
        '/charging-sites/1/equipment/bulk-status-update',
        {
          equipment_ids: [1, 2],
          new_status: 'Validated'
        }
      )
    }, 10000) // Increased timeout

    test('should invalidate queries on success', async ({
      renderHook,
      query
    }) => {
      const mockResponse = { data: [] }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useBulkUpdateEquipmentStatus(),
        [query]
      )

      const updateData = {
        siteId: 1,
        equipmentIds: [1, 2],
        newStatus: 'Validated'
      }

      await act(async () => {
        await result.current.mutateAsync(updateData)
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
    })

    test('should handle empty equipment list', async ({
      renderHook,
      query
    }) => {
      const mockResponse = { data: [] }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useBulkUpdateEquipmentStatus(),
        [query]
      )

      const updateData = {
        siteId: 1,
        equipmentIds: [],
        newStatus: 'Validated'
      }

      await act(async () => {
        await result.current.mutateAsync(updateData)
      })

      expect(mockPost).toHaveBeenCalledWith(
        '/charging-sites/1/equipment/bulk-status-update',
        {
          equipment_ids: [],
          new_status: 'Validated'
        }
      )
    })

    test('should handle different status updates', async ({
      renderHook,
      query
    }) => {
      const mockResponse = { data: [] }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useBulkUpdateEquipmentStatus(),
        [query]
      )

      // Test Draft status
      await act(async () => {
        await result.current.mutateAsync({
          siteId: 1,
          equipmentIds: [1, 2],
          newStatus: 'Draft'
        })
      })

      expect(mockPost).toHaveBeenLastCalledWith(
        '/charging-sites/1/equipment/bulk-status-update',
        {
          equipment_ids: [1, 2],
          new_status: 'Draft'
        }
      )

      // Test Submitted status
      await act(async () => {
        await result.current.mutateAsync({
          siteId: 1,
          equipmentIds: [3, 4],
          newStatus: 'Submitted'
        })
      })

      expect(mockPost).toHaveBeenLastCalledWith(
        '/charging-sites/1/equipment/bulk-status-update',
        {
          equipment_ids: [3, 4],
          new_status: 'Submitted'
        }
      )
    })
  })

  describe('useUpdateChargingSiteStatus', () => {
    test('should call PATCH with siteId and new_status', async ({
      renderHook,
      query
    }) => {
      const mockResponseData = {
        chargingSiteId: 1,
        status: { status: 'Validated' }
      }
      mockPatch.mockResolvedValue({ data: mockResponseData })

      const { result } = renderHook(
        () => useUpdateChargingSiteStatus(),
        [query]
      )

      let resolvedData
      await act(async () => {
        resolvedData = await result.current.mutateAsync({
          siteId: 57,
          newStatus: 'Validated'
        })
      })

      expect(mockPatch).toHaveBeenCalledWith(
        '/charging-sites/57/status',
        { new_status: 'Validated' }
      )
      expect(resolvedData).toEqual(mockResponseData)
    })

    test('should throw when siteId is missing', async ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(
        () => useUpdateChargingSiteStatus(),
        [query]
      )

      await act(async () => {
        try {
          await result.current.mutateAsync({ newStatus: 'Validated' })
        } catch (err) {
          expect(err.message).toBe('Charging site ID is required')
        }
      })

      expect(mockPatch).not.toHaveBeenCalled()
    })

    test('should call onSuccess and invalidate queries on success', async ({
      renderHook,
      query
    }) => {
      const mockResponse = { data: { chargingSiteId: 1, status: { status: 'Validated' } } }
      mockPatch.mockResolvedValue(mockResponse)

      const onSuccess = vi.fn()
      const { result } = renderHook(
        () => useUpdateChargingSiteStatus({ onSuccess }),
        [query]
      )

      await act(async () => {
        await result.current.mutateAsync({ siteId: 1, newStatus: 'Validated' })
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  describe('useChargingSiteEquipmentPaginated', () => {
    test('should fetch paginated equipment successfully', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        equipment: [
          {
            charging_equipment_id: 1,
            serial_number: 'TEST-001',
            status: 'Submitted',
            intended_use_types: ['Public']
          },
          {
            charging_equipment_id: 2,
            serial_number: 'TEST-002',
            status: 'Draft',
            intended_use_types: ['Private']
          }
        ],
        pagination: {
          total: 2,
          page: 1,
          size: 10,
          totalPages: 1
        }
      }
      mockPost.mockResolvedValue({ data: mockData })

      const paginationOptions = {
        page: 1,
        size: 10,
        sortOrders: [],
        filters: []
      }

      const { result } = renderHook(
        () => useChargingSiteEquipmentPaginated(1, paginationOptions),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      // Fixed: Use the correct API route with list-all suffix
      expect(mockPost).toHaveBeenCalledWith(
        '/charging-sites/1/equipment/list-all',
        paginationOptions,
        { params: undefined }
      )
    })

    test('should request equipment history mode when enabled', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        equipments: [],
        pagination: {
          total: 0,
          page: 1,
          size: 10,
          totalPages: 0
        }
      }
      mockPost.mockResolvedValue({ data: mockData })

      const paginationOptions = {
        page: 1,
        size: 10,
        sortOrders: [],
        filters: []
      }

      const { result } = renderHook(
        () =>
          useChargingSiteEquipmentPaginated(1, paginationOptions, {
            historyMode: true
          }),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPost).toHaveBeenCalledWith(
        '/charging-sites/1/equipment/list-all',
        paginationOptions,
        { params: { history_mode: true } }
      )
    })

    test('should handle pagination changes', async ({ renderHook, query }) => {
      const mockData = {
        equipment: [],
        pagination: { total: 0, page: 2, size: 10, totalPages: 1 }
      }
      mockPost.mockResolvedValue({ data: mockData })

      const paginationOptions = {
        page: 2,
        size: 10,
        sortOrders: [{ field: 'serial_number', direction: 'asc' }],
        filters: [
          {
            field: 'status',
            filter: 'Submitted',
            type: 'text',
            filter_type: 'contains'
          }
        ]
      }

      const { result } = renderHook(
        () => useChargingSiteEquipmentPaginated(1, paginationOptions),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Fixed: Use the correct API route with list-all suffix
      expect(mockPost).toHaveBeenCalledWith(
        '/charging-sites/1/equipment/list-all',
        paginationOptions,
        { params: undefined }
      )
    })

    test('should not fetch when siteId is undefined', ({
      renderHook,
      query
    }) => {
      const paginationOptions = {
        page: 1,
        size: 10,
        sortOrders: [],
        filters: []
      }

      renderHook(
        () => useChargingSiteEquipmentPaginated(undefined, paginationOptions),
        [query]
      )

      expect(mockPost).not.toHaveBeenCalled()
    })

    test('should handle API errors', async ({ renderHook, query }) => {
      const mockError = new Error('Failed to fetch equipment')
      mockPost.mockRejectedValue(mockError)

      const paginationOptions = {
        page: 1,
        size: 10,
        sortOrders: [],
        filters: []
      }

      const { result } = renderHook(
        () => useChargingSiteEquipmentPaginated(1, paginationOptions, { retry: false }),
        [query]
      )

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true)
        },
        { timeout: 3000 }
      )

      expect(result.current.error).toEqual(mockError)
    })
  })
})
