import { waitFor } from '@testing-library/react'
import { describe, expect, vi, beforeEach, afterEach } from 'vitest'
import { test } from '@/tests/utils/fixtures'
import {
  useChargingEquipment,
  useDownloadChargingEquipment,
  useGetChargingEquipment,
  useCreateChargingEquipment,
  useUpdateChargingEquipment,
  useDeleteChargingEquipment,
  useChargingEquipmentMetadata
} from '../useChargingEquipment'

// Mock the API service
const mockApiService = {
  post: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  download: vi.fn()
}

vi.mock('@/services/useApiService', () => ({
  useApiService: () => mockApiService
}))

vi.mock('@/constants/routes', () => ({
  apiRoutes: {
    chargingEquipment: {
      list: '/charging-equipment/list',
      get: '/charging-equipment/:id',
      create: '/charging-equipment/',
      update: '/charging-equipment/:id',
      delete: '/charging-equipment/:id',
      bulkSubmit: '/charging-equipment/bulk/submit',
      bulkDecommission: '/charging-equipment/bulk/decommission',
      export: '/charging-equipment/export',
      statuses: '/charging-equipment/statuses/list',
      levels: '/charging-equipment/levels/list',
      endUseTypes: '/charging-equipment/end-use-types/list',
      endUserTypes: '/charging-equipment/end-user-types/list'
    }
  }
}))

// Test data
const mockEquipmentData = {
  items: [
    {
      charging_equipment_id: 1,
      status: 'Draft',
      site_name: 'Test Site',
      registration_number: 'TEST1-001',
      serial_number: 'ABC123',
      manufacturer: 'Tesla'
    }
  ],
  total_count: 1,
  current_page: 1,
  total_pages: 1,
  page_size: 25
}

const mockSingleEquipment = {
  charging_equipment_id: 1,
  status: 'Draft',
  site_name: 'Test Site',
  registration_number: 'TEST1-001',
  serial_number: 'ABC123',
  manufacturer: 'Tesla',
  model: 'Supercharger'
}

const mockBulkActionResponse = {
  success: true,
  message: 'Successfully processed equipment',
  affected_count: 2,
  errors: []
}

describe('useChargingEquipment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('useChargingEquipment - list hook', () => {
    test('fetches charging equipment list successfully', async ({
      renderHook,
      query
    }) => {
      mockApiService.post.mockResolvedValue({ data: mockEquipmentData })

      const paginationOptions = {
        page: 1,
        size: 25,
        sortOrders: [],
        filters: {}
      }

      const { result } = renderHook(
        () => useChargingEquipment(paginationOptions),
        [query]
      )

      await waitFor(() => {
        expect(result.current.data).toEqual(mockEquipmentData)
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isError).toBe(false)
      })

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/charging-equipment/list',
        {
          page: 1,
          size: 25,
          sort_orders: [],
          filters: {}
        }
      )
    })

    test('handles bulk submit successfully', async ({ renderHook, query }) => {
      mockApiService.post.mockResolvedValueOnce({ data: mockEquipmentData })
      mockApiService.post.mockResolvedValueOnce({
        data: mockBulkActionResponse
      })

      const paginationOptions = {
        page: 1,
        size: 25,
        sortOrders: [],
        filters: {}
      }

      const { result } = renderHook(
        () => useChargingEquipment(paginationOptions),
        [query]
      )

      await waitFor(() => {
        expect(result.current.data).toBeDefined()
      })

      const response = await result.current.submitEquipment([1, 2])

      expect(response).toEqual(mockBulkActionResponse)
      expect(mockApiService.post).toHaveBeenCalledWith(
        '/charging-equipment/bulk/submit',
        { charging_equipment_ids: [1, 2] }
      )
    })

    test('handles bulk decommission successfully', async ({
      renderHook,
      query
    }) => {
      mockApiService.post.mockResolvedValueOnce({ data: mockEquipmentData })
      mockApiService.post.mockResolvedValueOnce({
        data: mockBulkActionResponse
      })

      const paginationOptions = {
        page: 1,
        size: 25,
        sortOrders: [],
        filters: {}
      }

      const { result } = renderHook(
        () => useChargingEquipment(paginationOptions),
        [query]
      )

      await waitFor(() => {
        expect(result.current.data).toBeDefined()
      })

      const response = await result.current.decommissionEquipment([1, 2])

      expect(response).toEqual(mockBulkActionResponse)
      expect(mockApiService.post).toHaveBeenCalledWith(
        '/charging-equipment/bulk/decommission',
        { charging_equipment_ids: [1, 2] }
      )
    })

    test('does not fetch when pagination options are not provided', ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(() => useChargingEquipment(null), [query])

      expect(result.current.data).toBeUndefined()
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useDownloadChargingEquipment', () => {
    test('downloads filtered charging equipment export', async ({
      renderHook,
      query
    }) => {
      mockApiService.download.mockResolvedValue(undefined)

      const { result } = renderHook(
        () => useDownloadChargingEquipment(),
        [query]
      )

      const requestBody = {
        page: 1,
        size: 1000,
        sortOrders: [{ field: 'updateDate', direction: 'desc' }],
        filters: [
          {
            field: 'manufacturer',
            filterType: 'text',
            type: 'contains',
            filter: 'Tesla'
          }
        ],
        organization_id: 7
      }

      await result.current.mutateAsync({ body: requestBody })

      expect(mockApiService.download).toHaveBeenCalledWith({
        url: '/charging-equipment/export',
        method: 'post',
        data: requestBody
      })
    })
  })

  describe('useGetChargingEquipment', () => {
    test('fetches single equipment successfully', async ({
      renderHook,
      query
    }) => {
      mockApiService.get.mockResolvedValue({ data: mockSingleEquipment })

      const { result } = renderHook(() => useGetChargingEquipment(1), [query])

      await waitFor(() => {
        expect(result.current.data).toEqual(mockSingleEquipment)
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isError).toBe(false)
      })

      expect(mockApiService.get).toHaveBeenCalledWith('/charging-equipment/1')
    })

    test('does not fetch when id is not provided', ({ renderHook, query }) => {
      const { result } = renderHook(
        () => useGetChargingEquipment(null),
        [query]
      )

      expect(result.current.data).toBeUndefined()
      expect(mockApiService.get).not.toHaveBeenCalled()
    })
  })

  describe('useCreateChargingEquipment', () => {
    test('creates equipment successfully', async ({ renderHook, query }) => {
      mockApiService.post.mockResolvedValue({ data: mockSingleEquipment })

      const { result } = renderHook(() => useCreateChargingEquipment(), [query])

      const createData = {
        charging_site_id: 1,
        serial_number: 'ABC123',
        manufacturer: 'Tesla',
        level_of_equipment_id: 1
      }

      const response = await result.current.mutateAsync(createData)

      expect(response).toEqual(mockSingleEquipment)
      expect(mockApiService.post).toHaveBeenCalledWith(
        '/charging-equipment/',
        createData
      )
    })
  })

  describe('useUpdateChargingEquipment', () => {
    test('updates equipment successfully', async ({ renderHook, query }) => {
      mockApiService.put.mockResolvedValue({ data: mockSingleEquipment })

      const { result } = renderHook(() => useUpdateChargingEquipment(), [query])

      const updateData = {
        manufacturer: 'ChargePoint',
        model: 'Express Plus'
      }

      const response = await result.current.mutateAsync({
        id: 1,
        data: updateData
      })

      expect(response).toEqual(mockSingleEquipment)
      expect(mockApiService.put).toHaveBeenCalledWith(
        '/charging-equipment/1',
        updateData
      )
    })
  })

  describe('useDeleteChargingEquipment', () => {
    test('deletes equipment successfully', async ({ renderHook, query }) => {
      mockApiService.delete.mockResolvedValue({})

      const { result } = renderHook(() => useDeleteChargingEquipment(), [query])

      await result.current.mutateAsync(1)

      expect(mockApiService.delete).toHaveBeenCalledWith(
        '/charging-equipment/1'
      )
    })
  })

  describe('useChargingEquipmentMetadata', () => {
    test('fetches all metadata successfully', async ({ renderHook, query }) => {
      const mockStatuses = [
        { status_id: 1, status: 'Draft' },
        { status_id: 2, status: 'Submitted' }
      ]
      const mockLevels = [
        { level_of_equipment_id: 1, name: 'Level 1' },
        { level_of_equipment_id: 2, name: 'Level 2' }
      ]
      const mockEndUseTypes = [
        { end_use_type_id: 1, type: 'Commercial' },
        { end_use_type_id: 2, type: 'Residential' }
      ]

      mockApiService.get
        .mockResolvedValueOnce({ data: mockStatuses })
        .mockResolvedValueOnce({ data: mockLevels })
        .mockResolvedValueOnce({ data: mockEndUseTypes })

      const { result } = renderHook(
        () => useChargingEquipmentMetadata(),
        [query]
      )

      await waitFor(() => {
        expect(result.current.statuses).toEqual(mockStatuses)
        expect(result.current.levels).toEqual(mockLevels)
        expect(result.current.endUseTypes).toEqual(mockEndUseTypes)
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockApiService.get).toHaveBeenCalledWith(
        '/charging-equipment/statuses/list'
      )
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/charging-equipment/levels/list'
      )
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/charging-equipment/end-use-types/list'
      )
    })

    test('shows loading state while fetching metadata', async ({
      renderHook,
      query
    }) => {
      // Make the API calls return promises that never resolve to keep loading state
      mockApiService.get.mockReturnValue(new Promise(() => {}))

      const { result } = renderHook(
        () => useChargingEquipmentMetadata(),
        [query]
      )

      expect(result.current.isLoading).toBe(true)
      expect(result.current.statuses).toBeUndefined()
      expect(result.current.levels).toBeUndefined()
      expect(result.current.endUseTypes).toBeUndefined()
    })
  })

  describe('error handling', () => {
    test('handles API errors in list fetch', async ({ renderHook, query }) => {
      const error = new Error('API Error')
      mockApiService.post.mockRejectedValue(error)

      const paginationOptions = {
        page: 1,
        size: 25,
        sortOrders: [],
        filters: {}
      }

      const { result } = renderHook(
        () => useChargingEquipment(paginationOptions),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
        expect(result.current.error).toBe(error)
      })
    })

    test('handles API errors in mutations', async ({ renderHook, query }) => {
      const error = new Error('Mutation Error')
      mockApiService.post.mockRejectedValue(error)

      const { result } = renderHook(() => useCreateChargingEquipment(), [query])

      try {
        await result.current.mutateAsync({
          charging_site_id: 1,
          serial_number: 'ABC123'
        })
      } catch (caughtError) {
        expect(caughtError).toBe(error)
      }
    })
  })
})
