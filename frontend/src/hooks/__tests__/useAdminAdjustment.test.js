import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'
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

  it('should fetch admin adjustment successfully', async () => {
    const mockData = {
      adminAdjustmentId: 123,
      toOrganizationId: 456,
      complianceUnits: 1000,
      govComment: 'Test comment',
      currentStatus: { status: 'Draft' }
    }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useAdminAdjustment(123), {
      wrapper
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
    expect(mockGet).toHaveBeenCalledWith('/admin-adjustments/123')
  })

  it('should attempt to fetch when ID is missing but fail', async () => {
    mockGet.mockRejectedValue(new Error('Request failed'))
    const { result } = renderHook(() => useAdminAdjustment(), { wrapper })

    // Should attempt to call with undefined ID
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(mockGet).toHaveBeenCalledWith('/admin-adjustments/undefined')
  })

  it('should handle API errors', async () => {
    const errorMessage = 'Failed to fetch admin adjustment'
    mockGet.mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(
      () => useAdminAdjustment(123, { retry: false }),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(new Error(errorMessage))
  })

  it('should pass through custom options', async () => {
    const mockData = { adminAdjustmentId: 123 }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(
      () => useAdminAdjustment(123, { staleTime: 5000 }),
      { wrapper }
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

  it('should create admin adjustment successfully', async () => {
    const mockData = {
      adminAdjustmentId: 1,
      message: 'Admin adjustment created successfully'
    }
    mockPost.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useCreateUpdateAdminAdjustment(), {
      wrapper
    })

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

  it('should update admin adjustment successfully', async () => {
    const mockData = {
      adminAdjustmentId: 123,
      message: 'Admin adjustment updated successfully'
    }
    mockPut.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useCreateUpdateAdminAdjustment(123), {
      wrapper
    })

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

  it('should handle API errors during admin adjustment creation', async () => {
    const errorMessage = 'Failed to create admin adjustment'
    mockPost.mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(() => useCreateUpdateAdminAdjustment(), {
      wrapper
    })

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

  it('should return mutation object with correct properties', async () => {
    const { result } = renderHook(() => useCreateUpdateAdminAdjustment(), {
      wrapper
    })

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

  it('should handle successful response data correctly', async () => {
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

    const { result } = renderHook(() => useCreateUpdateAdminAdjustment(), {
      wrapper
    })

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

  it('should handle empty adjustment data', async () => {
    const mockData = { message: 'Empty adjustment processed' }
    mockPost.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useCreateUpdateAdminAdjustment(), {
      wrapper
    })

    result.current.mutate({ data: {} })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockPost).toHaveBeenCalledWith('/admin-adjustments/', {})
    expect(result.current.data).toEqual({ data: mockData })
  })

  it('should handle adjustment with all optional fields', async () => {
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

    const { result } = renderHook(() => useCreateUpdateAdminAdjustment(), {
      wrapper
    })

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
