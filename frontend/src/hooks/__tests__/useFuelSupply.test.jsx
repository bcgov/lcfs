import { waitFor } from '@testing-library/react'
import { vi, describe, expect, beforeEach, afterEach } from 'vitest'
import { test } from '@/tests/utils/fixtures'
import {
  useFuelSupplyOptions,
  useGetFuelSupplies,
  useGetFuelSuppliesList,
  useSaveFuelSupply,
  useUpdateFuelSupply,
  useDeleteFuelSupply
} from '../useFuelSupply'

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
    fuelSupplyOptions: '/fuel-supply/table-options?',
    getAllFuelSupplies: '/fuel-supplies/list',
    saveFuelSupplies: '/fuel-supplies'
  }
}))

vi.mock('@/constants/statuses', () => ({
  REPORT_SCHEDULES_VIEW: {
    VIEW: 'view',
    EDIT: 'edit'
  }
}))

describe('useFuelSupply', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('useFuelSupplyOptions', () => {
    test('should fetch fuel supply options successfully', async ({
      renderHook,
      query
    }) => {
      const mockOptions = {
        fuelTypes: ['Gasoline', 'Diesel'],
        fuelCategories: ['Renewable', 'Non-renewable']
      }
      mockApiService.get.mockResolvedValue({ data: mockOptions })

      const { result } = renderHook(
        () => useFuelSupplyOptions({ compliancePeriod: 2024 }),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockOptions)
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/fuel-supply/table-options?compliancePeriod=2024'
      )
    })

    test('should not fetch when compliancePeriod is missing', ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(() => useFuelSupplyOptions({}), [query])

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    test('should handle enabled option', ({ renderHook, query }) => {
      const { result } = renderHook(
        () =>
          useFuelSupplyOptions({ compliancePeriod: 2024 }, { enabled: false }),
        [query]
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    test('should handle API errors', async ({ renderHook, query }) => {
      const mockError = new Error('API Error')
      mockApiService.get.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useFuelSupplyOptions({ compliancePeriod: 2024 }, { retry: 0 }),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useGetFuelSupplies', () => {
    test('should fetch fuel supplies successfully', async ({
      renderHook,
      query
    }) => {
      const mockSupplies = {
        fuelSupplies: [
          { id: 1, fuelType: 'Gasoline' },
          { id: 2, fuelType: 'Diesel' }
        ],
        pagination: { total: 2, page: 1 }
      }
      mockApiService.post.mockResolvedValue({ data: mockSupplies })

      const pagination = { page: 1, size: 10 }
      const { result } = renderHook(
        () => useGetFuelSupplies(123, pagination),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockSupplies)
      expect(mockApiService.post).toHaveBeenCalledWith('/fuel-supplies/list', {
        complianceReportId: 123,
        ...pagination
      })
    })

    test('should not fetch when complianceReportId is missing', ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(
        () => useGetFuelSupplies(null, { page: 1, size: 10 }),
        [query]
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })

    test('should handle enabled option', ({ renderHook, query }) => {
      const { result } = renderHook(
        () =>
          useGetFuelSupplies(123, { page: 1, size: 10 }, { enabled: false }),
        [query]
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useGetFuelSuppliesList', () => {
    test('should fetch fuel supplies list successfully with default mode', async ({
      renderHook,
      query
    }) => {
      const mockSupplies = {
        fuelSupplies: [
          { id: 1, fuelType: 'Gasoline' },
          { id: 2, fuelType: 'Diesel' }
        ],
        pagination: { total: 2, page: 1 }
      }
      mockApiService.post.mockResolvedValue({ data: mockSupplies })

      const pagination = { page: 1, size: 10 }
      const { result } = renderHook(
        () => useGetFuelSuppliesList({ complianceReportId: 123 }, pagination),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockSupplies)
      expect(mockApiService.post).toHaveBeenCalledWith('/fuel-supplies/list', {
        complianceReportId: 123,
        mode: 'view',
        ...pagination
      })
    })

    test('should fetch fuel supplies list with edit mode', async ({
      renderHook,
      query
    }) => {
      const mockSupplies = {
        fuelSupplies: [],
        pagination: { total: 0, page: 1 }
      }
      mockApiService.post.mockResolvedValue({ data: mockSupplies })

      const pagination = { page: 1, size: 10 }
      const { result } = renderHook(
        () =>
          useGetFuelSuppliesList(
            { complianceReportId: 123, mode: 'edit' },
            pagination
          ),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith('/fuel-supplies/list', {
        complianceReportId: 123,
        mode: 'edit',
        ...pagination
      })
    })

    test('should not fetch when complianceReportId is missing', ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(
        () => useGetFuelSuppliesList({}, { page: 1, size: 10 }),
        [query]
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useSaveFuelSupply', () => {
    test('should save fuel supply successfully', async ({
      renderHook,
      query
    }) => {
      const mockResponse = { data: { id: 1, fuelType: 'Gasoline' } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useSaveFuelSupply({ complianceReportId: 123 }),
        [query]
      )

      const supplyData = {
        fuelType: 'Gasoline',
        quantity: 1000
      }

      result.current.mutate(supplyData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith('/fuel-supplies', {
        complianceReportId: 123,
        ...supplyData
      })
    })

    test('should handle save errors', async ({ renderHook, query }) => {
      const mockError = new Error('Save failed')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useSaveFuelSupply({ complianceReportId: 123 }),
        [query]
      )

      result.current.mutate({ fuelType: 'Gasoline' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    test('should invalidate main report queries after saving fuel supply', async ({
      renderHook,
      query
    }) => {
      mockApiService.post.mockResolvedValue({ data: { id: 1 } })
      const invalidateSpy = vi.spyOn(query.client, 'invalidateQueries')

      const { result } = renderHook(
        () => useSaveFuelSupply({ complianceReportId: 123 }),
        [query]
      )

      result.current.mutate({ fuelType: 'Gasoline', quantity: 1000 })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['compliance-report-summary', 123]
      })
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['compliance-report', 123]
      })
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['compliance-report-schedule-overview', 123]
      })
    })
  })

  describe('useUpdateFuelSupply', () => {
    test('should update fuel supply successfully', async ({
      renderHook,
      query
    }) => {
      const mockResponse = { data: { id: 1, fuelType: 'Updated Gasoline' } }
      mockApiService.put.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useUpdateFuelSupply({ complianceReportId: 123 }),
        [query]
      )

      const supplyData = {
        id: 1,
        fuelType: 'Updated Gasoline',
        quantity: 1500
      }

      result.current.mutate(supplyData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.put).toHaveBeenCalledWith('/fuel-supplies/1', {
        complianceReportId: 123,
        ...supplyData
      })
    })

    test('should handle update errors', async ({ renderHook, query }) => {
      const mockError = new Error('Update failed')
      mockApiService.put.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useUpdateFuelSupply({ complianceReportId: 123 }),
        [query]
      )

      result.current.mutate({ id: 1, fuelType: 'Gasoline' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    test('should invalidate main report queries after updating fuel supply', async ({
      renderHook,
      query
    }) => {
      mockApiService.put.mockResolvedValue({ data: { id: 1 } })
      const invalidateSpy = vi.spyOn(query.client, 'invalidateQueries')

      const { result } = renderHook(
        () => useUpdateFuelSupply({ complianceReportId: 123 }),
        [query]
      )

      result.current.mutate({ id: 1, fuelType: 'Diesel', quantity: 1500 })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['compliance-report-summary', 123]
      })
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['compliance-report', 123]
      })
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['compliance-report-schedule-overview', 123]
      })
    })
  })

  describe('useDeleteFuelSupply', () => {
    test('should delete fuel supply successfully', async ({
      renderHook,
      query
    }) => {
      mockApiService.delete.mockResolvedValue({ data: {} })

      const { result } = renderHook(
        () => useDeleteFuelSupply({ complianceReportId: 123 }),
        [query]
      )

      result.current.mutate(1)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.delete).toHaveBeenCalledWith('/fuel-supplies/1')
    })

    test('should handle delete errors', async ({ renderHook, query }) => {
      const mockError = new Error('Delete failed')
      mockApiService.delete.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useDeleteFuelSupply({ complianceReportId: 123 }),
        [query]
      )

      result.current.mutate(1)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    test('should invalidate main report queries after deleting fuel supply', async ({
      renderHook,
      query
    }) => {
      mockApiService.delete.mockResolvedValue({ data: {} })
      const invalidateSpy = vi.spyOn(query.client, 'invalidateQueries')

      const { result } = renderHook(
        () => useDeleteFuelSupply({ complianceReportId: 123 }),
        [query]
      )

      result.current.mutate(1)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['compliance-report-summary', 123]
      })
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['compliance-report', 123]
      })
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['compliance-report-schedule-overview', 123]
      })
    })
  })
})
