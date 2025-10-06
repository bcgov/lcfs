import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import { useApiService } from '@/services/useApiService'
import { useOrganizationFuelSupply } from '../useFuelSupply'

vi.mock('@/services/useApiService')

describe('useOrganizationFuelSupply', () => {
  const mockPost = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({
      post: mockPost
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch organization fuel supply successfully', async () => {
    const mockResponseData = {
      fuelSupplies: [
        {
          fuelSupplyId: 1,
          compliancePeriod: '2023',
          reportSubmissionDate: '2023-03-31',
          fuelType: 'Diesel',
          fuelCategory: 'Petroleum-based',
          provisionOfTheAct: 'Default carbon intensity - section 19 (b) (ii)',
          fuelCode: null,
          fuelQuantity: 50000,
          units: 'L',
          complianceReportId: 101
        },
        {
          fuelSupplyId: 2,
          compliancePeriod: '2023',
          reportSubmissionDate: '2023-03-31',
          fuelType: 'Gasoline',
          fuelCategory: 'Petroleum-based',
          provisionOfTheAct: 'Fuel code - section 19 (b) (i)',
          fuelCode: 'BCLCF123.1',
          fuelQuantity: 75000,
          units: 'L',
          complianceReportId: 101
        }
      ],
      analytics: {
        totalVolume: 125000,
        totalFuelTypes: 2,
        totalReports: 1,
        mostRecentSubmission: '2023-03-31',
        totalByFuelType: { Diesel: 50000, Gasoline: 75000 },
        totalByYear: { '2023': 125000 },
        totalByFuelCategory: { 'Petroleum-based': 125000 },
        totalByProvision: {
          'Default carbon intensity - section 19 (b) (ii)': 50000,
          'Fuel code - section 19 (b) (i)': 75000
        }
      },
      pagination: {
        page: 1,
        size: 10,
        total: 2,
        totalPages: 1
      }
    }

    mockPost.mockResolvedValue({ data: mockResponseData })

    const organizationId = 1
    const pagination = { page: 1, size: 10, filters: [] }

    const { result } = renderHook(
      () => useOrganizationFuelSupply(organizationId, pagination),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockPost).toHaveBeenCalledWith(
      '/fuel-supply/organization/1',
      pagination
    )
    expect(result.current.data).toEqual(mockResponseData)
    expect(result.current.data.fuelSupplies).toHaveLength(2)
    expect(result.current.data.analytics.totalVolume).toBe(125000)
    expect(result.current.data.pagination.total).toBe(2)
  })

  it('should handle year filter in pagination', async () => {
    const mockResponseData = {
      fuelSupplies: [
        {
          fuelSupplyId: 1,
          compliancePeriod: '2023',
          reportSubmissionDate: '2023-03-31',
          fuelType: 'Diesel',
          fuelCategory: 'Renewable',
          provisionOfTheAct: 'Test Provision',
          fuelCode: null,
          fuelQuantity: 30000,
          units: 'L',
          complianceReportId: 101
        }
      ],
      analytics: {
        totalVolume: 30000,
        totalFuelTypes: 1,
        totalReports: 1,
        mostRecentSubmission: '2023-03-31',
        totalByFuelType: { Diesel: 30000 },
        totalByYear: { '2023': 30000 },
        totalByFuelCategory: { Renewable: 30000 },
        totalByProvision: { 'Test Provision': 30000 }
      },
      pagination: {
        page: 1,
        size: 10,
        total: 1,
        totalPages: 1
      }
    }

    mockPost.mockResolvedValue({ data: mockResponseData })

    const organizationId = 1
    const pagination = {
      page: 1,
      size: 10,
      filters: [
        { field: 'compliancePeriod', filter: '2023', type: 'text' }
      ]
    }

    const { result } = renderHook(
      () => useOrganizationFuelSupply(organizationId, pagination),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockPost).toHaveBeenCalledWith(
      '/fuel-supply/organization/1',
      pagination
    )
    expect(result.current.data.fuelSupplies).toHaveLength(1)
    expect(result.current.data.fuelSupplies[0].compliancePeriod).toBe('2023')
  })

  it('should handle empty results', async () => {
    const mockResponseData = {
      fuelSupplies: [],
      analytics: {
        totalVolume: 0,
        totalFuelTypes: 0,
        totalReports: 0,
        mostRecentSubmission: null,
        totalByFuelType: {},
        totalByYear: {},
        totalByFuelCategory: {},
        totalByProvision: {}
      },
      pagination: {
        page: 1,
        size: 10,
        total: 0,
        totalPages: 0
      }
    }

    mockPost.mockResolvedValue({ data: mockResponseData })

    const organizationId = 999
    const pagination = { page: 1, size: 10, filters: [] }

    const { result } = renderHook(
      () => useOrganizationFuelSupply(organizationId, pagination),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data.fuelSupplies).toHaveLength(0)
    expect(result.current.data.analytics.totalVolume).toBe(0)
    expect(result.current.data.pagination.total).toBe(0)
  })

  it('should handle pagination correctly', async () => {
    const mockResponseData = {
      fuelSupplies: Array.from({ length: 5 }, (_, i) => ({
        fuelSupplyId: i + 6,
        compliancePeriod: '2023',
        reportSubmissionDate: '2023-03-31',
        fuelType: `Fuel Type ${i + 6}`,
        fuelCategory: 'Renewable',
        provisionOfTheAct: 'Test Provision',
        fuelCode: null,
        fuelQuantity: 1000 * (i + 6),
        units: 'L',
        complianceReportId: 101
      })),
      analytics: {
        totalVolume: 40000,
        totalFuelTypes: 5,
        totalReports: 1,
        mostRecentSubmission: '2023-03-31',
        totalByFuelType: {},
        totalByYear: { '2023': 40000 },
        totalByFuelCategory: { Renewable: 40000 },
        totalByProvision: { 'Test Provision': 40000 }
      },
      pagination: {
        page: 2,
        size: 5,
        total: 13,
        totalPages: 3
      }
    }

    mockPost.mockResolvedValue({ data: mockResponseData })

    const organizationId = 1
    const pagination = { page: 2, size: 5, filters: [] }

    const { result } = renderHook(
      () => useOrganizationFuelSupply(organizationId, pagination),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data.fuelSupplies).toHaveLength(5)
    expect(result.current.data.pagination.page).toBe(2)
    expect(result.current.data.pagination.size).toBe(5)
    expect(result.current.data.pagination.total).toBe(13)
    expect(result.current.data.pagination.totalPages).toBe(3)
  })

  it('should not fetch when organization ID is missing', async () => {
    const organizationId = null
    const pagination = { page: 1, size: 10, filters: [] }

    const { result } = renderHook(
      () => useOrganizationFuelSupply(organizationId, pagination),
      { wrapper }
    )

    // Should remain in idle state
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))

    expect(mockPost).not.toHaveBeenCalled()
  })

  it('should handle API errors gracefully', async () => {
    const errorMessage = 'Failed to fetch fuel supply data'
    mockPost.mockRejectedValue(new Error(errorMessage))

    const organizationId = 1
    const pagination = { page: 1, size: 10, filters: [] }

    const { result } = renderHook(
      () => useOrganizationFuelSupply(organizationId, pagination),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
    expect(mockPost).toHaveBeenCalledWith(
      '/fuel-supply/organization/1',
      pagination
    )
  })

  it('should cache results based on query key', async () => {
    const mockResponseData = {
      fuelSupplies: [],
      analytics: {
        totalVolume: 0,
        totalFuelTypes: 0,
        totalReports: 0,
        mostRecentSubmission: null,
        totalByFuelType: {},
        totalByYear: {},
        totalByFuelCategory: {},
        totalByProvision: {}
      },
      pagination: { page: 1, size: 10, total: 0, totalPages: 0 }
    }

    mockPost.mockResolvedValue({ data: mockResponseData })

    const organizationId = 1
    const pagination1 = { page: 1, size: 10, filters: [] }
    const pagination2 = { page: 2, size: 10, filters: [] }

    // First call
    const { result: result1 } = renderHook(
      () => useOrganizationFuelSupply(organizationId, pagination1),
      { wrapper }
    )
    await waitFor(() => expect(result1.current.isSuccess).toBe(true))

    // Second call with different pagination should trigger new fetch
    const { result: result2 } = renderHook(
      () => useOrganizationFuelSupply(organizationId, pagination2),
      { wrapper }
    )
    await waitFor(() => expect(result2.current.isSuccess).toBe(true))

    // Should have been called twice with different pagination
    expect(mockPost).toHaveBeenCalledTimes(2)
  })

  it('should handle null submission dates in response', async () => {
    const mockResponseData = {
      fuelSupplies: [
        {
          fuelSupplyId: 1,
          compliancePeriod: '2023',
          reportSubmissionDate: null,
          fuelType: 'Diesel',
          fuelCategory: 'Petroleum-based',
          provisionOfTheAct: 'Test Provision',
          fuelCode: null,
          fuelQuantity: 50000,
          units: 'L',
          complianceReportId: 101
        }
      ],
      analytics: {
        totalVolume: 50000,
        totalFuelTypes: 1,
        totalReports: 0,
        mostRecentSubmission: null,
        totalByFuelType: { Diesel: 50000 },
        totalByYear: { '2023': 50000 },
        totalByFuelCategory: { 'Petroleum-based': 50000 },
        totalByProvision: { 'Test Provision': 50000 }
      },
      pagination: { page: 1, size: 10, total: 1, totalPages: 1 }
    }

    mockPost.mockResolvedValue({ data: mockResponseData })

    const { result } = renderHook(
      () => useOrganizationFuelSupply(1, { page: 1, size: 10, filters: [] }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data.fuelSupplies[0].reportSubmissionDate).toBeNull()
    expect(result.current.data.analytics.mostRecentSubmission).toBeNull()
  })
})
