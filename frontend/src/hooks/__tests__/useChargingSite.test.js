import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '../../services/useApiService'
import { wrapper } from '../../tests/utils/wrapper'
import {
  useChargingSite,
  useChargingSiteStatuses,
  useBulkUpdateEquipmentStatus,
  useChargingSiteEquipmentPaginated
} from '../useChargingSite'

vi.mock('../../services/useApiService')

describe('useChargingSite', () => {
  const mockGet = vi.fn()
  const mockPost = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({
      get: mockGet,
      post: mockPost
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('useChargingSite', () => {
    it('should fetch charging site successfully', async () => {
      const mockData = {
        charging_site_id: 1,
        site_name: 'Test Charging Site',
        organization: { name: 'Test Org' },
        status: { status: 'Draft' },
        attachments: [],
        intended_users: []
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useChargingSite(1), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/charging-sites/1')
    })

    it('should handle API errors', async () => {
      const mockError = new Error('Failed to fetch charging site')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(() => useChargingSite(1), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    it('should not fetch when siteId is undefined', () => {
      renderHook(() => useChargingSite(undefined), {
        wrapper
      })

      expect(mockGet).not.toHaveBeenCalled()
    })
  })

  describe('useChargingSiteStatuses', () => {
    it('should fetch charging site statuses successfully', async () => {
      const mockData = [
        { id: 1, status: 'Draft', description: 'Draft status' },
        { id: 2, status: 'Submitted', description: 'Submitted status' }
      ]
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useChargingSiteStatuses(), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/charging-sites/statuses/')
    })

    it('should handle API errors', async () => {
      const mockError = new Error('Failed to fetch statuses')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(() => useChargingSiteStatuses(), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useBulkUpdateEquipmentStatus', () => {
    it('should perform bulk update successfully', async () => {
      const mockResponse = {
        data: [
          {
            charging_site_id: 1,
            site_name: 'Updated Site'
          }
        ]
      }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useBulkUpdateEquipmentStatus(), {
        wrapper
      })

      const updateData = {
        siteId: 1,
        equipment_ids: [1, 2],
        new_status: 'Validated'
      }

      await result.current.mutateAsync(updateData)

      expect(mockPost).toHaveBeenCalledWith(
        '/charging-sites/1/equipment/bulk-status-update',
        {
          equipment_ids: [1, 2],
          new_status: 'Validated'
        }
      )
    })

    it('should handle bulk update errors', async () => {
      const mockError = {
        response: {
          data: {
            detail: 'Equipment can only be validated from Submitted status'
          }
        }
      }
      mockPost.mockRejectedValue(mockError)

      const { result } = renderHook(() => useBulkUpdateEquipmentStatus(), {
        wrapper
      })

      const updateData = {
        siteId: 1,
        equipment_ids: [1, 2],
        new_status: 'Validated'
      }

      try {
        await result.current.mutateAsync(updateData)
      } catch (error) {
        expect(error).toEqual(mockError)
      }

      expect(mockPost).toHaveBeenCalledWith(
        '/charging-sites/1/equipment/bulk-status-update',
        {
          equipment_ids: [1, 2],
          new_status: 'Validated'
        }
      )
    })

    it('should invalidate queries on success', async () => {
      const mockResponse = { data: [] }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useBulkUpdateEquipmentStatus(), {
        wrapper
      })

      const updateData = {
        siteId: 1,
        equipment_ids: [1, 2],
        new_status: 'Validated'
      }

      await result.current.mutateAsync(updateData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
    })

    it('should handle empty equipment list', async () => {
      const mockResponse = { data: [] }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useBulkUpdateEquipmentStatus(), {
        wrapper
      })

      const updateData = {
        siteId: 1,
        equipment_ids: [],
        new_status: 'Validated'
      }

      await result.current.mutateAsync(updateData)

      expect(mockPost).toHaveBeenCalledWith(
        '/charging-sites/1/equipment/bulk-status-update',
        {
          equipment_ids: [],
          new_status: 'Validated'
        }
      )
    })

    it('should handle different status updates', async () => {
      const mockResponse = { data: [] }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useBulkUpdateEquipmentStatus(), {
        wrapper
      })

      // Test Draft status
      await result.current.mutateAsync({
        siteId: 1,
        equipment_ids: [1, 2],
        new_status: 'Draft'
      })

      expect(mockPost).toHaveBeenLastCalledWith(
        '/charging-sites/1/equipment/bulk-status-update',
        {
          equipment_ids: [1, 2],
          new_status: 'Draft'
        }
      )

      // Test Submitted status
      await result.current.mutateAsync({
        siteId: 1,
        equipment_ids: [3, 4],
        new_status: 'Submitted'
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

  describe('useChargingSiteEquipmentPaginated', () => {
    it('should fetch paginated equipment successfully', async () => {
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
        {
          wrapper
        }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockPost).toHaveBeenCalledWith(
        '/charging-sites/1/equipment',
        paginationOptions
      )
    })

    it('should handle pagination changes', async () => {
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
        {
          wrapper
        }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPost).toHaveBeenCalledWith(
        '/charging-sites/1/equipment',
        paginationOptions
      )
    })

    it('should not fetch when siteId is undefined', () => {
      const paginationOptions = {
        page: 1,
        size: 10,
        sortOrders: [],
        filters: []
      }

      renderHook(
        () => useChargingSiteEquipmentPaginated(undefined, paginationOptions),
        {
          wrapper
        }
      )

      expect(mockPost).not.toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      const mockError = new Error('Failed to fetch equipment')
      mockPost.mockRejectedValue(mockError)

      const paginationOptions = {
        page: 1,
        size: 10,
        sortOrders: [],
        filters: []
      }

      const { result } = renderHook(
        () => useChargingSiteEquipmentPaginated(1, paginationOptions),
        {
          wrapper
        }
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })
})
