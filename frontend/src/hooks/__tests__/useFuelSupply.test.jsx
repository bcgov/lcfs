import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
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

// Using the standard test wrapper from utils

describe('useFuelSupply', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useFuelSupplyOptions', () => {
    it('should fetch fuel supply options successfully', async () => {
      const mockOptions = {
        fuelTypes: ['Gasoline', 'Diesel'],
        fuelCategories: ['Renewable', 'Non-renewable']
      }
      mockApiService.get.mockResolvedValue({ data: mockOptions })

      const { result } = renderHook(
        () => useFuelSupplyOptions({ compliancePeriod: 2024 }),
        { wrapper: wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockOptions)
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/fuel-supply/table-options?compliancePeriod=2024'
      )
    })

    it('should not fetch when compliancePeriod is missing', () => {
      const { result } = renderHook(() => useFuelSupplyOptions({}), {
        wrapper: wrapper
      })

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle enabled option', () => {
      const { result } = renderHook(
        () =>
          useFuelSupplyOptions({ compliancePeriod: 2024 }, { enabled: false }),
        { wrapper: wrapper }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      const mockError = new Error('API Error')
      mockApiService.get.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useFuelSupplyOptions({ compliancePeriod: 2024 }, { retry: 0 }),
        { wrapper: wrapper }
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useGetFuelSupplies', () => {
    it('should fetch fuel supplies successfully', async () => {
      const mockSupplies = {
        fuelSupplies: [
          { id: 1, fuelType: 'Gasoline' },
          { id: 2, fuelType: 'Diesel' }
        ],
        pagination: { total: 2, page: 1 }
      }
      mockApiService.post.mockResolvedValue({ data: mockSupplies })

      const pagination = { page: 1, size: 10 }
      const { result } = renderHook(() => useGetFuelSupplies(123, pagination), {
        wrapper: wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockSupplies)
      expect(mockApiService.post).toHaveBeenCalledWith('/fuel-supplies/list', {
        complianceReportId: 123,
        ...pagination
      })
    })

    it('should not fetch when complianceReportId is missing', () => {
      const { result } = renderHook(
        () => useGetFuelSupplies(null, { page: 1, size: 10 }),
        { wrapper: wrapper }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })

    it('should handle enabled option', () => {
      const { result } = renderHook(
        () =>
          useGetFuelSupplies(123, { page: 1, size: 10 }, { enabled: false }),
        { wrapper: wrapper }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useGetFuelSuppliesList', () => {
    it('should fetch fuel supplies list successfully with default mode', async () => {
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
        { wrapper: wrapper }
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

    it('should fetch fuel supplies list with edit mode', async () => {
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
        { wrapper: wrapper }
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

    it('should not fetch when complianceReportId is missing', () => {
      const { result } = renderHook(
        () => useGetFuelSuppliesList({}, { page: 1, size: 10 }),
        { wrapper: wrapper }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useSaveFuelSupply', () => {
    it('should save fuel supply successfully', async () => {
      const mockResponse = { data: { id: 1, fuelType: 'Gasoline' } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useSaveFuelSupply({ complianceReportId: 123 }),
        { wrapper: wrapper }
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

    it('should handle save errors', async () => {
      const mockError = new Error('Save failed')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useSaveFuelSupply({ complianceReportId: 123 }),
        { wrapper: wrapper }
      )

      result.current.mutate({ fuelType: 'Gasoline' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useUpdateFuelSupply', () => {
    it('should update fuel supply successfully', async () => {
      const mockResponse = { data: { id: 1, fuelType: 'Updated Gasoline' } }
      mockApiService.put.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useUpdateFuelSupply({ complianceReportId: 123 }),
        { wrapper: wrapper }
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

    it('should handle update errors', async () => {
      const mockError = new Error('Update failed')
      mockApiService.put.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useUpdateFuelSupply({ complianceReportId: 123 }),
        { wrapper: wrapper }
      )

      result.current.mutate({ id: 1, fuelType: 'Gasoline' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useDeleteFuelSupply', () => {
    it('should delete fuel supply successfully', async () => {
      mockApiService.delete.mockResolvedValue({ data: {} })

      const { result } = renderHook(
        () => useDeleteFuelSupply({ complianceReportId: 123 }),
        { wrapper: wrapper }
      )

      result.current.mutate(1)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.delete).toHaveBeenCalledWith('/fuel-supplies/1')
    })

    it('should handle delete errors', async () => {
      const mockError = new Error('Delete failed')
      mockApiService.delete.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useDeleteFuelSupply({ complianceReportId: 123 }),
        { wrapper: wrapper }
      )

      result.current.mutate(1)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })
})
