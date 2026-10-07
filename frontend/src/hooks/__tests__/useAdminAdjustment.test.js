import { waitFor } from '@testing-library/react'
import { describe, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { test } from '@/tests/utils/fixtures'
import {
  useAdminAdjustment,
  useCreateUpdateAdminAdjustment
} from '../useAdminAdjustment'

vi.mock('@/services/useApiService')

describe('useAdminAdjustment', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('should fetch admin adjustment successfully', async ({
    renderHook,
    query
  }) => {
    const mockData = {
      adminAdjustmentId: 123,
      toOrganizationId: 456,
      complianceUnits: 1000,
      govComment: 'Test comment',
      currentStatus: { status: 'Draft' }
    }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useAdminAdjustment(123), [query])

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
    expect(mockGet).toHaveBeenCalledWith('/admin-adjustments/123')
  })

  test('should attempt to fetch when ID is missing but fail', async ({
    renderHook,
    query
  }) => {
    mockGet.mockRejectedValue(new Error('Request failed'))
    const { result } = renderHook(() => useAdminAdjustment(), [query])

    // Should attempt to call with undefined ID
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(mockGet).toHaveBeenCalledWith('/admin-adjustments/undefined')
  })

  test('should handle API errors', async ({ renderHook, query }) => {
    const errorMessage = 'Failed to fetch admin adjustment'
    mockGet.mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(
      () => useAdminAdjustment(123, { retry: false }),
      [query]
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(new Error(errorMessage))
  })

  test('should pass through custom options', async ({ renderHook, query }) => {
    const mockData = { adminAdjustmentId: 123 }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(
      () => useAdminAdjustment(123, { staleTime: 5000 }),
      [query]
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
  })
})

describe('useCreateUpdateAdminAdjustment', () => {
  const mockPost = vi.fn()
  const mockPut = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({
      post: mockPost,
      put: mockPut
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('should create admin adjustment successfully', async ({
    renderHook,
    query
  }) => {
    const mockData = {
      adminAdjustmentId: 1,
      message: 'Admin adjustment created successfully'
    }
    mockPost.mockResolvedValue({ data: mockData })

    const { result } = renderHook(
      () => useCreateUpdateAdminAdjustment(),
      [query]
    )

    const adjustmentData = {
      organizationId: 123,
      adjustmentType: 'CREDIT',
      amount: 1000,
      description: 'Test adjustment'
    }

    result.current.mutate({ data: adjustmentData })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockPost).toHaveBeenCalledWith('/admin-adjustments/', adjustmentData)
    expect(result.current.data).toEqual({ data: mockData })
  })

  test('should update admin adjustment successfully', async ({
    renderHook,
    query
  }) => {
    const mockData = {
      adminAdjustmentId: 123,
      message: 'Admin adjustment updated successfully'
    }
    mockPut.mockResolvedValue({ data: mockData })

    const { result } = renderHook(
      () => useCreateUpdateAdminAdjustment(123),
      [query]
    )

    const adjustmentData = {
      organizationId: 456,
      adjustmentType: 'DEBIT',
      amount: 500,
      description: 'Updated adjustment'
    }

    result.current.mutate({ data: adjustmentData })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockPut).toHaveBeenCalledWith('/admin-adjustments/', {
      ...adjustmentData,
      adminAdjustmentId: 123
    })
    expect(result.current.data).toEqual({ data: mockData })
  })

  test('should handle API errors during admin adjustment creation', async ({
    renderHook,
    query
  }) => {
    const errorMessage = 'Failed to create admin adjustment'
    mockPost.mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(
      () => useCreateUpdateAdminAdjustment(),
      [query]
    )

    const adjustmentData = {
      organizationId: 123,
      adjustmentType: 'CREDIT',
      amount: 1000,
      description: 'Test adjustment'
    }

    result.current.mutate({ data: adjustmentData })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(new Error(errorMessage))
  })

  test('should return mutation object with correct properties', async ({
    renderHook,
    query
  }) => {
    const { result } = renderHook(
      () => useCreateUpdateAdminAdjustment(),
      [query]
    )

    expect(result.current).toHaveProperty('mutate')
    expect(result.current).toHaveProperty('mutateAsync')
    expect(result.current).toHaveProperty('isPending')
    expect(result.current).toHaveProperty('isError')
    expect(result.current).toHaveProperty('isSuccess')
    expect(result.current).toHaveProperty('data')
    expect(result.current).toHaveProperty('error')
    expect(result.current).toHaveProperty('reset')
    expect(typeof result.current.mutate).toBe('function')
    expect(typeof result.current.mutateAsync).toBe('function')
  })

  test('should handle successful response data correctly', async ({
    renderHook,
    query
  }) => {
    const mockResponse = {
      adminAdjustmentId: 456,
      organizationId: 123,
      adjustmentType: 'DEBIT',
      amount: 500,
      description: 'Test debit adjustment',
      status: 'PROCESSED',
      createdAt: '2023-01-01T10:00:00Z'
    }
    mockPost.mockResolvedValue({ data: mockResponse })

    const { result } = renderHook(
      () => useCreateUpdateAdminAdjustment(),
      [query]
    )

    const adjustmentData = {
      organizationId: 123,
      adjustmentType: 'DEBIT',
      amount: 500,
      description: 'Test debit adjustment'
    }

    result.current.mutate({ data: adjustmentData })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data.data).toEqual(mockResponse)
    expect(result.current.data.data.adminAdjustmentId).toBe(456)
    expect(result.current.data.data.adjustmentType).toBe('DEBIT')
  })

  test('should handle empty adjustment data', async ({ renderHook, query }) => {
    const mockData = { message: 'Empty adjustment processed' }
    mockPost.mockResolvedValue({ data: mockData })

    const { result } = renderHook(
      () => useCreateUpdateAdminAdjustment(),
      [query]
    )

    result.current.mutate({ data: {} })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockPost).toHaveBeenCalledWith('/admin-adjustments/', {})
    expect(result.current.data).toEqual({ data: mockData })
  })

  test('should handle adjustment with all optional fields', async ({
    renderHook,
    query
  }) => {
    const fullAdjustmentData = {
      organizationId: 789,
      adjustmentType: 'CREDIT',
      amount: 2500,
      description: 'Comprehensive test adjustment',
      referenceNumber: 'REF-123',
      comments: 'Additional comments',
      effectiveDate: '2023-12-01',
      category: 'COMPLIANCE'
    }

    const mockResponse = {
      adminAdjustmentId: 999,
      ...fullAdjustmentData,
      status: 'PROCESSED',
      createdAt: '2023-01-01T10:00:00Z'
    }
    mockPost.mockResolvedValue({ data: mockResponse })

    const { result } = renderHook(
      () => useCreateUpdateAdminAdjustment(),
      [query]
    )

    result.current.mutate({ data: fullAdjustmentData })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockPost).toHaveBeenCalledWith(
      '/admin-adjustments/',
      fullAdjustmentData
    )
    expect(result.current.data.data).toEqual(mockResponse)
    expect(result.current.data.data.referenceNumber).toBe('REF-123')
    expect(result.current.data.data.category).toBe('COMPLIANCE')
  })
})
