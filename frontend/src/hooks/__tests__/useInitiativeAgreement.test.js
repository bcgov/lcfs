import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'
import {
  useInitiativeAgreement,
  useCreateUpdateInitiativeAgreement
} from '../useInitiativeAgreement'

vi.mock('@/services/useApiService')

describe('useInitiativeAgreement', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch initiative agreement successfully', async () => {
    const mockData = {
      initiativeAgreementId: 123,
      transactionType: 'Compliance Report',
      status: 'active'
    }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useInitiativeAgreement(123), {
      wrapper
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
    expect(mockGet).toHaveBeenCalledWith('/initiative-agreements/123')
  })

  it('should attempt to fetch when ID is missing but fail', async () => {
    mockGet.mockRejectedValue(new Error('Request failed'))
    const { result } = renderHook(() => useInitiativeAgreement(), { wrapper })

    // Should attempt to call with undefined ID
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(mockGet).toHaveBeenCalledWith('/initiative-agreements/undefined')
  })

  it('should attempt to fetch when ID is undefined but fail', async () => {
    mockGet.mockRejectedValue(new Error('Request failed'))
    const { result } = renderHook(() => useInitiativeAgreement(undefined), {
      wrapper
    })

    // Should attempt to call with undefined ID
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(mockGet).toHaveBeenCalledWith('/initiative-agreements/undefined')
  })

  it('should handle API errors', async () => {
    const errorMessage = 'Failed to fetch initiative agreement'
    mockGet.mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(
      () => useInitiativeAgreement(123, { retry: false }),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(new Error(errorMessage))
    expect(mockGet).toHaveBeenCalledWith('/initiative-agreements/123')
  })

  it('should pass through custom options', async () => {
    const mockData = { initiativeAgreementId: 123 }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(
      () => useInitiativeAgreement(123, { staleTime: 5000 }),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
  })
})

describe('useCreateUpdateInitiativeAgreement', () => {
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

  it('should create new initiative agreement when no ID provided', async () => {
    const mockData = { message: 'Initiative agreement created successfully' }
    mockPost.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useCreateUpdateInitiativeAgreement(), {
      wrapper
    })

    const testData = { transactionType: 'Compliance Report' }
    result.current.mutate({ data: testData })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockPost).toHaveBeenCalledWith('/initiative-agreements/', testData)
    expect(result.current.data).toEqual({ data: mockData })
  })

  it('should update existing initiative agreement when ID provided', async () => {
    const mockData = { message: 'Initiative agreement updated successfully' }
    mockPut.mockResolvedValue({ data: mockData })

    const { result } = renderHook(
      () => useCreateUpdateInitiativeAgreement(123),
      { wrapper }
    )

    const testData = { transactionType: 'Compliance Report' }
    result.current.mutate({ data: testData })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockPut).toHaveBeenCalledWith('/initiative-agreements/', {
      ...testData,
      initiativeAgreementId: 123
    })
    expect(result.current.data).toEqual({ data: mockData })
  })

  it('should handle API errors during creation', async () => {
    const errorMessage = 'Failed to create initiative agreement'
    mockPost.mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(() => useCreateUpdateInitiativeAgreement(), {
      wrapper
    })

    const testData = { transactionType: 'Compliance Report' }
    result.current.mutate({ data: testData })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(new Error(errorMessage))
  })

  it('should handle API errors during update', async () => {
    const errorMessage = 'Failed to update initiative agreement'
    mockPut.mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(
      () => useCreateUpdateInitiativeAgreement(123),
      { wrapper }
    )

    const testData = { transactionType: 'Compliance Report' }
    result.current.mutate({ data: testData })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(new Error(errorMessage))
  })
})
