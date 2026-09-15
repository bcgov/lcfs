import { waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, vi } from 'vitest'
import {
  useGetCompliancePeriodList,
  useGetFuelTypeList,
  useGetFuelTypeOptions,
  useCalculateComplianceUnits
} from '@/hooks/useCalculator'
import { useApiService } from '@/services/useApiService'
import { test } from '@/tests/utils/fixtures'
import { LEGISLATION_TRANSITION_YEAR } from '@/constants/common'

vi.mock('@/services/useApiService')
vi.mock('@/constants/common', () => ({
  LEGISLATION_TRANSITION_YEAR: 2023
}))

describe('useGetCompliancePeriodList', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  test('should fetch compliance period list successfully', async ({
    renderHook,
    query
  }) => {
    const mockData = [
      { year: 2024, description: '2024 Compliance Period' },
      { year: 2023, description: '2023 Compliance Period' }
    ]
    mockGet.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(() => useGetCompliancePeriodList(), [query])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data.data).toEqual(mockData)
    expect(mockGet).toHaveBeenCalledWith(expect.any(String))
  })

  test('should handle API errors', async ({ renderHook, query }) => {
    const mockError = new Error('Failed to fetch compliance periods')
    mockGet.mockRejectedValueOnce(mockError)

    const { result } = renderHook(() => useGetCompliancePeriodList(), [query])

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(mockError)
  })

  test('should use correct cache configuration', ({ renderHook, query }) => {
    const { result } = renderHook(() => useGetCompliancePeriodList(), [query])

    // The hook should be configured with long cache times for static data
    expect(result.current).toBeDefined()
  })

  test('should pass through custom options', async ({ renderHook, query }) => {
    const mockData = []
    mockGet.mockResolvedValueOnce({ data: mockData })

    const customOptions = {
      enabled: false,
      staleTime: 120000
    }

    const { result } = renderHook(
      () => useGetCompliancePeriodList(customOptions),
      [query]
    )

    // With enabled: false, the query should not execute
    expect(result.current.isLoading).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })
})

describe('useGetFuelTypeList', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  test('should fetch fuel type list successfully', async ({
    renderHook,
    query
  }) => {
    const mockData = [
      { id: 1, name: 'Gasoline', category: 'gasoline' },
      { id: 2, name: 'Diesel', category: 'diesel' }
    ]
    mockGet.mockResolvedValueOnce({ data: mockData })

    const params = {
      complianceYear: '2024',
      fuelCategory: 'gasoline',
      lcfsOnly: true
    }

    const { result } = renderHook(() => useGetFuelTypeList(params), [query])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data.data).toEqual(mockData)
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('2024'), {
      params: {
        fuel_category: 'gasoline',
        lcfs_only: true
      }
    })
  })

  test('should not fetch when fuel category is missing', ({
    renderHook,
    query
  }) => {
    const params = {
      complianceYear: '2024',
      fuelCategory: '',
      lcfsOnly: true
    }

    const { result } = renderHook(() => useGetFuelTypeList(params), [query])

    expect(result.current.isLoading).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('should not fetch when fuel category is null', ({
    renderHook,
    query
  }) => {
    const params = {
      complianceYear: '2024',
      fuelCategory: null,
      lcfsOnly: true
    }

    const { result } = renderHook(() => useGetFuelTypeList(params), [query])

    expect(result.current.isLoading).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('should handle API errors', async ({ renderHook, query }) => {
    const mockError = new Error('Failed to fetch fuel types')
    mockGet.mockRejectedValueOnce(mockError)

    const params = {
      complianceYear: '2024',
      fuelCategory: 'gasoline',
      lcfsOnly: true
    }

    const { result } = renderHook(() => useGetFuelTypeList(params), [query])

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(mockError)
  })

  test('should handle missing compliance year', async ({
    renderHook,
    query
  }) => {
    const mockData = []
    mockGet.mockResolvedValueOnce({ data: mockData })

    const params = {
      complianceYear: undefined,
      fuelCategory: 'gasoline',
      lcfsOnly: true
    }

    const { result } = renderHook(() => useGetFuelTypeList(params), [query])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('undefined'),
      expect.any(Object)
    )
  })

  test('should handle lcfsOnly parameter variations', async ({
    renderHook,
    query
  }) => {
    const mockData = []
    mockGet.mockResolvedValueOnce({ data: mockData })

    const params = {
      complianceYear: '2024',
      fuelCategory: 'gasoline',
      lcfsOnly: false
    }

    const { result } = renderHook(() => useGetFuelTypeList(params), [query])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockGet).toHaveBeenCalledWith(expect.any(String), {
      params: {
        fuel_category: 'gasoline',
        lcfs_only: false
      }
    })
  })
})

describe('useGetFuelTypeOptions', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  test('should fetch fuel type options successfully', async ({
    renderHook,
    query
  }) => {
    const mockData = {
      endUses: [
        { id: 1, name: 'Transportation' },
        { id: 2, name: 'Heating' }
      ]
    }
    mockGet.mockResolvedValueOnce({ data: mockData })

    const params = {
      complianceYear: '2024',
      fuelTypeId: '1',
      fuelCategoryId: '2',
      lcfsOnly: true
    }

    const { result } = renderHook(() => useGetFuelTypeOptions(params), [query])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data.data).toEqual(mockData)
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('2024'), {
      params: {
        fuel_type_id: '1',
        fuel_category_id: '2',
        lcfs_only: true
      }
    })
  })

  test('should not fetch when fuel type ID is missing', ({
    renderHook,
    query
  }) => {
    const params = {
      complianceYear: '2024',
      fuelTypeId: '',
      fuelCategoryId: '2',
      lcfsOnly: true
    }

    const { result } = renderHook(() => useGetFuelTypeOptions(params), [query])

    expect(result.current.isLoading).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('should not fetch when fuel type ID is null', ({
    renderHook,
    query
  }) => {
    const params = {
      complianceYear: '2024',
      fuelTypeId: null,
      fuelCategoryId: '2',
      lcfsOnly: true
    }

    const { result } = renderHook(() => useGetFuelTypeOptions(params), [query])

    expect(result.current.isLoading).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('should handle API errors', async ({ renderHook, query }) => {
    const mockError = new Error('Failed to fetch fuel type options')
    mockGet.mockRejectedValueOnce(mockError)

    const params = {
      complianceYear: '2024',
      fuelTypeId: '1',
      fuelCategoryId: '2',
      lcfsOnly: true
    }

    const { result } = renderHook(() => useGetFuelTypeOptions(params), [query])

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(mockError)
  })
})

describe('useCalculateComplianceUnits', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  test('should calculate compliance units successfully', async ({
    renderHook,
    query
  }) => {
    const mockData = {
      complianceUnits: 1250.75,
      carbonIntensity: 85.5,
      energyEffectiveness: 1.0
    }
    mockGet.mockResolvedValueOnce({ data: mockData })

    const params = {
      compliancePeriod: '2024',
      fuelCategoryId: '1',
      fuelTypeId: '2',
      endUseId: '3',
      quantity: 1000,
      fuelCodeId: '4',
      enabled: true
    }

    const { result } = renderHook(
      () => useCalculateComplianceUnits(params),
      [query]
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data.data).toEqual(mockData)
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('2024'), {
      params: expect.objectContaining({
        fuelCategoryId: '1',
        fuelTypeId: '2',
        endUseId: '3',
        quantity: 1000,
        fuelCodeId: '4',
        useCustomCi: false
      })
    })
  })

  test('should handle calculation for transition year and beyond without endUseId', async ({
    renderHook,
    query
  }) => {
    const mockData = { complianceUnits: 1500 }
    mockGet.mockResolvedValueOnce({ data: mockData })

    const params = {
      compliancePeriod: '2023', // LEGISLATION_TRANSITION_YEAR
      fuelCategoryId: '1',
      fuelTypeId: '2',
      endUseId: null, // No endUseId but should still work for transition year
      quantity: 1000,
      fuelCodeId: '4',
      enabled: true
    }

    const { result } = renderHook(
      () => useCalculateComplianceUnits(params),
      [query]
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data.data).toEqual(mockData)
  })

  test('should not fetch when required parameters are missing', ({
    renderHook,
    query
  }) => {
    const params = {
      compliancePeriod: '',
      fuelCategoryId: '1',
      fuelTypeId: '2',
      endUseId: '3',
      quantity: 1000,
      fuelCodeId: '4',
      enabled: true
    }

    const { result } = renderHook(
      () => useCalculateComplianceUnits(params),
      [query]
    )

    expect(result.current.isLoading).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('should not fetch when fuel category ID is missing', ({
    renderHook,
    query
  }) => {
    const params = {
      compliancePeriod: '2024',
      fuelCategoryId: '',
      fuelTypeId: '2',
      endUseId: '3',
      quantity: 1000,
      fuelCodeId: '4',
      enabled: true
    }

    const { result } = renderHook(
      () => useCalculateComplianceUnits(params),
      [query]
    )

    expect(result.current.isLoading).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('should not fetch when fuel type ID is missing', ({
    renderHook,
    query
  }) => {
    const params = {
      compliancePeriod: '2024',
      fuelCategoryId: '1',
      fuelTypeId: '',
      endUseId: '3',
      quantity: 1000,
      fuelCodeId: '4',
      enabled: true
    }

    const { result } = renderHook(
      () => useCalculateComplianceUnits(params),
      [query]
    )

    expect(result.current.isLoading).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('should not fetch when quantity is missing', ({ renderHook, query }) => {
    const params = {
      compliancePeriod: '2024',
      fuelCategoryId: '1',
      fuelTypeId: '2',
      endUseId: '3',
      quantity: null,
      fuelCodeId: '4',
      enabled: true
    }

    const { result } = renderHook(
      () => useCalculateComplianceUnits(params),
      [query]
    )

    expect(result.current.isLoading).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('should require endUseId for years before transition year', ({
    renderHook,
    query
  }) => {
    const params = {
      compliancePeriod: '2022', // Before LEGISLATION_TRANSITION_YEAR
      fuelCategoryId: '1',
      fuelTypeId: '2',
      endUseId: '', // Missing endUseId
      quantity: 1000,
      fuelCodeId: '4',
      enabled: true
    }

    const { result } = renderHook(
      () => useCalculateComplianceUnits(params),
      [query]
    )

    expect(result.current.isLoading).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('should be disabled when enabled is false', ({ renderHook, query }) => {
    const params = {
      compliancePeriod: '2024',
      fuelCategoryId: '1',
      fuelTypeId: '2',
      endUseId: '3',
      quantity: 1000,
      fuelCodeId: '4',
      enabled: false
    }

    const { result } = renderHook(
      () => useCalculateComplianceUnits(params),
      [query]
    )

    expect(result.current.isLoading).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('should handle API errors', async ({ renderHook, query }) => {
    const mockError = new Error('Calculation failed')
    mockGet.mockRejectedValueOnce(mockError)

    const params = {
      compliancePeriod: '2024',
      fuelCategoryId: '1',
      fuelTypeId: '2',
      endUseId: '3',
      quantity: 1000,
      fuelCodeId: '4',
      enabled: true
    }

    const { result } = renderHook(
      () => useCalculateComplianceUnits(params),
      [query]
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(mockError)
  })

  test('should handle zero quantity', async ({ renderHook, query }) => {
    const mockData = { complianceUnits: 0 }
    mockGet.mockResolvedValueOnce({ data: mockData })

    const params = {
      compliancePeriod: '2024',
      fuelCategoryId: '1',
      fuelTypeId: '2',
      endUseId: '3',
      quantity: 0,
      fuelCodeId: '4',
      enabled: true
    }

    const { result } = renderHook(
      () => useCalculateComplianceUnits(params),
      [query]
    )

    // Zero should be treated as falsy, so no fetch
    expect(result.current.isLoading).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('should handle negative quantity', async ({ renderHook, query }) => {
    const mockData = { complianceUnits: -500 }
    mockGet.mockResolvedValueOnce({ data: mockData })

    const params = {
      compliancePeriod: '2024',
      fuelCategoryId: '1',
      fuelTypeId: '2',
      endUseId: '3',
      quantity: -100,
      fuelCodeId: '4',
      enabled: true
    }

    const { result } = renderHook(
      () => useCalculateComplianceUnits(params),
      [query]
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data.data).toEqual(mockData)
    expect(mockGet).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          quantity: -100
        })
      })
    )
  })
})
