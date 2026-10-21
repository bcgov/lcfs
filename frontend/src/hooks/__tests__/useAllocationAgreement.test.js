import { waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, vi } from 'vitest'
import {
  useAllocationAgreementOptions,
  useGetAllocationAgreements,
  useGetAllAllocationAgreements,
  useGetAllocationAgreementsList,
  useSaveAllocationAgreement,
  useUpdateAllocationAgreement,
  useDeleteAllocationAgreement,
  useImportAllocationAgreement,
  useGetAllocationAgreementImportJobStatus
} from '@/hooks/useAllocationAgreement'
import { useApiService } from '@/services/useApiService'
import { test } from '@/tests/utils/fixtures'

vi.mock('@/services/useApiService')

describe('useAllocationAgreementOptions', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  test('should fetch allocation agreement options successfully', async ({
    renderHook,
    query
  }) => {
    const mockData = { options: ['option1', 'option2'] }
    mockGet.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () => useAllocationAgreementOptions({ compliancePeriod: '2024' }),
      [query]
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockData)
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('compliancePeriod=2024')
    )
  })

  test('should handle missing compliance period', ({ renderHook, query }) => {
    const { result } = renderHook(
      () => useAllocationAgreementOptions({}),
      [query]
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('should not fetch when compliance period is missing', ({
    renderHook,
    query
  }) => {
    const { result } = renderHook(
      () => useAllocationAgreementOptions({ compliancePeriod: null }),
      [query]
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('should handle fetch errors when compliance period is provided', async ({
    renderHook,
    query
  }) => {
    const mockError = new Error('API Error')
    mockGet.mockRejectedValue(mockError)

    const { result } = renderHook(
      () =>
        useAllocationAgreementOptions(
          { compliancePeriod: '2024' },
          { retry: false }
        ),
      [query]
    )

    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 2000
    })
    expect(result.current.error).toEqual(mockError)
  })

  test('should be disabled when enabled is false', ({ renderHook, query }) => {
    const { result } = renderHook(
      () =>
        useAllocationAgreementOptions(
          { compliancePeriod: '2024' },
          { enabled: false }
        ),
      [query]
    )

    expect(result.current.isLoading).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })
})

describe('useGetAllocationAgreements', () => {
  const mockPost = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ post: mockPost })
  })

  test('should fetch allocation agreements successfully', async ({
    renderHook,
    query
  }) => {
    const mockData = { agreements: [], totalCount: 0 }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () => useGetAllocationAgreements('123', { page: 1, size: 10 }),
      [query]
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockData)
    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        complianceReportId: '123',
        page: 1,
        size: 10
      })
    )
  })

  test('should handle missing compliance report ID', ({
    renderHook,
    query
  }) => {
    const { result } = renderHook(
      () => useGetAllocationAgreements(null, { page: 1, size: 10 }),
      [query]
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockPost).not.toHaveBeenCalled()
  })

  test('should not fetch when compliance report ID is missing', ({
    renderHook,
    query
  }) => {
    const { result } = renderHook(
      () => useGetAllocationAgreements(null, { page: 1, size: 10 }),
      [query]
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockPost).not.toHaveBeenCalled()
  })

  test('should handle fetch errors when compliance report ID is provided', async ({
    renderHook,
    query
  }) => {
    const mockError = new Error('API Error')
    mockPost.mockRejectedValue(mockError)

    const { result } = renderHook(
      () =>
        useGetAllocationAgreements(
          '123',
          { page: 1, size: 10 },
          { retry: false }
        ),
      [query]
    )

    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 2000
    })
    expect(result.current.error).toEqual(mockError)
  })
})

describe('useGetAllAllocationAgreements', () => {
  const mockPost = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ post: mockPost })
  })

  test('should fetch all allocation agreements successfully', async ({
    renderHook,
    query
  }) => {
    const mockData = { agreements: [], totalCount: 0 }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () => useGetAllAllocationAgreements('123', { page: 1, size: 10 }),
      [query]
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockData)
    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        complianceReportId: '123',
        page: 1,
        size: 10
      })
    )
  })

  test('should handle missing compliance report ID', ({
    renderHook,
    query
  }) => {
    const { result } = renderHook(
      () => useGetAllAllocationAgreements(null, { page: 1, size: 10 }),
      [query]
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockPost).not.toHaveBeenCalled()
  })

  test('should not fetch when compliance report ID is missing', ({
    renderHook,
    query
  }) => {
    const { result } = renderHook(
      () => useGetAllAllocationAgreements(null, { page: 1, size: 10 }),
      [query]
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockPost).not.toHaveBeenCalled()
  })
})

describe('useGetAllocationAgreementsList', () => {
  const mockPost = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ post: mockPost })
  })

  test('should fetch allocation agreements list successfully', async ({
    renderHook,
    query
  }) => {
    const mockData = { agreements: [], totalCount: 0 }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () =>
        useGetAllocationAgreementsList(
          { complianceReportId: '123' },
          { page: 1, size: 10 }
        ),
      [query]
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockData)
    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        complianceReportId: '123',
        changelog: false,
        page: 1,
        size: 10
      })
    )
  })

  test('should handle changelog parameter', async ({ renderHook, query }) => {
    const mockData = { agreements: [], totalCount: 0 }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () =>
        useGetAllocationAgreementsList(
          { complianceReportId: '123', changelog: true },
          { page: 1, size: 10 }
        ),
      [query]
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockData)
    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        complianceReportId: '123',
        changelog: true,
        page: 1,
        size: 10
      })
    )
  })
})

describe('useSaveAllocationAgreement', () => {
  const mockPost = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ post: mockPost })
  })

  test('should save allocation agreement successfully', async ({
    renderHook,
    query
  }) => {
    const mockData = { id: 1, success: true }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () => useSaveAllocationAgreement({ complianceReportId: '123' }),
      [query]
    )

    const testData = { name: 'Test Agreement' }
    result.current.mutate(testData)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        complianceReportId: '123',
        name: 'Test Agreement'
      })
    )
  })

  test('should handle missing compliance report ID', async ({
    renderHook,
    query
  }) => {
    const { result } = renderHook(() => useSaveAllocationAgreement({}), [query])

    const testData = { name: 'Test Agreement' }
    result.current.mutate(testData)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe(
      'Compliance report ID is required'
    )
  })

  test('should handle missing data', async ({ renderHook, query }) => {
    const { result } = renderHook(
      () => useSaveAllocationAgreement({ complianceReportId: '123' }),
      [query]
    )

    result.current.mutate(null)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe(
      'Allocation agreement data is required'
    )
  })
})

describe('useUpdateAllocationAgreement', () => {
  const mockPut = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ put: mockPut })
  })

  test('should provide mutation function for update operations', ({
    renderHook,
    query
  }) => {
    const { result } = renderHook(
      () => useUpdateAllocationAgreement({ complianceReportId: '123' }),
      [query]
    )

    expect(result.current.mutate).toBeDefined()
    expect(typeof result.current.mutate).toBe('function')
    expect(result.current.isIdle).toBe(true)
  })

  test('should handle API errors in update operations', async ({
    renderHook,
    query
  }) => {
    const mockError = new Error('Update failed')
    mockPut.mockRejectedValueOnce(mockError)

    const { result } = renderHook(
      () => useUpdateAllocationAgreement({ complianceReportId: '123' }),
      [query]
    )

    const testData = { id: '1', name: 'Updated Agreement' }
    result.current.mutate(testData)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(mockError)
  })
})

describe('useDeleteAllocationAgreement', () => {
  const mockDelete = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ delete: mockDelete })
  })

  test('should provide mutation function for delete operations', ({
    renderHook,
    query
  }) => {
    const { result } = renderHook(
      () => useDeleteAllocationAgreement({ complianceReportId: '123' }),
      [query]
    )

    expect(result.current.mutate).toBeDefined()
    expect(typeof result.current.mutate).toBe('function')
    expect(result.current.isIdle).toBe(true)
  })

  test('should handle API errors in delete operations', async ({
    renderHook,
    query
  }) => {
    const mockError = new Error('Delete failed')
    mockDelete.mockRejectedValueOnce(mockError)

    const { result } = renderHook(
      () => useDeleteAllocationAgreement({ complianceReportId: '123' }),
      [query]
    )

    result.current.mutate('agreement-id-123')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(mockError)
  })
})

describe('useImportAllocationAgreement', () => {
  const mockPost = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ post: mockPost })
  })

  test('should provide mutation function for import operations', ({
    renderHook,
    query
  }) => {
    const { result } = renderHook(
      () => useImportAllocationAgreement('123'),
      [query]
    )

    expect(result.current.mutate).toBeDefined()
    expect(typeof result.current.mutate).toBe('function')
    expect(result.current.isIdle).toBe(true)
  })

  test('should handle API errors in import operations', async ({
    renderHook,
    query
  }) => {
    const mockError = new Error('Import failed')
    mockPost.mockRejectedValueOnce(mockError)

    const { result } = renderHook(
      () => useImportAllocationAgreement('123'),
      [query]
    )

    const file = new File(['test'], 'test.csv')
    result.current.mutate({ file, isOverwrite: false })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(mockError)
  })
})

describe('useGetAllocationAgreementImportJobStatus', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  test('should fetch job status successfully', async ({
    renderHook,
    query
  }) => {
    const mockData = { status: 'completed', progress: 100 }
    mockGet.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () => useGetAllocationAgreementImportJobStatus('job-123'),
      [query]
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockData)
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('job-123'))
  })

  test('should not fetch when job ID is missing', ({ renderHook, query }) => {
    const { result } = renderHook(
      () => useGetAllocationAgreementImportJobStatus(null),
      [query]
    )

    expect(result.current.isLoading).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('should handle fetch errors when job ID is provided', async ({
    renderHook,
    query
  }) => {
    const mockError = new Error('API Error')
    mockGet.mockRejectedValue(mockError)

    const { result } = renderHook(
      () =>
        useGetAllocationAgreementImportJobStatus('job-123', { retry: false }),
      [query]
    )

    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 2000
    })
    expect(result.current.error).toEqual(mockError)
  })
})
