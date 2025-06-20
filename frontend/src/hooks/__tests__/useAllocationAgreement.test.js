import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('@/services/useApiService')

describe('useAllocationAgreementOptions', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  it('should fetch allocation agreement options successfully', async () => {
    const mockData = { options: ['option1', 'option2'] }
    mockGet.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () => useAllocationAgreementOptions({ compliancePeriod: '2024' }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockData)
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('compliancePeriod=2024')
    )
  })

  it('should handle missing compliance period', () => {
    const { result } = renderHook(() => useAllocationAgreementOptions({}), {
      wrapper
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('should not fetch when compliance period is missing', () => {
    const { result } = renderHook(
      () => useAllocationAgreementOptions({ compliancePeriod: null }),
      { wrapper }
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('should handle fetch errors when compliance period is provided', async () => {
    const mockError = new Error('API Error')
    mockGet.mockRejectedValue(mockError)

    const { result } = renderHook(
      () =>
        useAllocationAgreementOptions(
          { compliancePeriod: '2024' },
          { retry: false }
        ),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 2000
    })
    expect(result.current.error).toEqual(mockError)
  })

  it('should be disabled when enabled is false', () => {
    const { result } = renderHook(
      () =>
        useAllocationAgreementOptions(
          { compliancePeriod: '2024' },
          { enabled: false }
        ),
      { wrapper }
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

  it('should fetch allocation agreements successfully', async () => {
    const mockData = { agreements: [], totalCount: 0 }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () => useGetAllocationAgreements('123', { page: 1, size: 10 }),
      { wrapper }
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

  it('should handle missing compliance report ID', () => {
    const { result } = renderHook(
      () => useGetAllocationAgreements(null, { page: 1, size: 10 }),
      { wrapper }
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('should not fetch when compliance report ID is missing', () => {
    const { result } = renderHook(
      () => useGetAllocationAgreements(null, { page: 1, size: 10 }),
      { wrapper }
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('should handle fetch errors when compliance report ID is provided', async () => {
    const mockError = new Error('API Error')
    mockPost.mockRejectedValue(mockError)

    const { result } = renderHook(
      () =>
        useGetAllocationAgreements(
          '123',
          { page: 1, size: 10 },
          { retry: false }
        ),
      { wrapper }
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

  it('should fetch all allocation agreements successfully', async () => {
    const mockData = { agreements: [], totalCount: 0 }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () => useGetAllAllocationAgreements('123', { page: 1, size: 10 }),
      { wrapper }
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

  it('should handle missing compliance report ID', () => {
    const { result } = renderHook(
      () => useGetAllAllocationAgreements(null, { page: 1, size: 10 }),
      { wrapper }
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('should not fetch when compliance report ID is missing', () => {
    const { result } = renderHook(
      () => useGetAllAllocationAgreements(null, { page: 1, size: 10 }),
      { wrapper }
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

  it('should fetch allocation agreements list successfully', async () => {
    const mockData = { agreements: [], totalCount: 0 }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () =>
        useGetAllocationAgreementsList(
          { complianceReportId: '123' },
          { page: 1, size: 10 }
        ),
      { wrapper }
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

  it('should handle changelog parameter', async () => {
    const mockData = { agreements: [], totalCount: 0 }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () =>
        useGetAllocationAgreementsList(
          { complianceReportId: '123', changelog: true },
          { page: 1, size: 10 }
        ),
      { wrapper }
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

  it('should save allocation agreement successfully', async () => {
    const mockData = { id: 1, success: true }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () => useSaveAllocationAgreement({ complianceReportId: '123' }),
      { wrapper }
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

  it('should handle missing compliance report ID', async () => {
    const { result } = renderHook(() => useSaveAllocationAgreement({}), {
      wrapper
    })

    const testData = { name: 'Test Agreement' }
    result.current.mutate(testData)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe(
      'Compliance report ID is required'
    )
  })

  it('should handle missing data', async () => {
    const { result } = renderHook(
      () => useSaveAllocationAgreement({ complianceReportId: '123' }),
      { wrapper }
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

  it('should provide mutation function for update operations', () => {
    const { result } = renderHook(
      () => useUpdateAllocationAgreement({ complianceReportId: '123' }),
      { wrapper }
    )

    expect(result.current.mutate).toBeDefined()
    expect(typeof result.current.mutate).toBe('function')
    expect(result.current.isIdle).toBe(true)
  })

  it('should handle API errors in update operations', async () => {
    const mockError = new Error('Update failed')
    mockPut.mockRejectedValueOnce(mockError)

    const { result } = renderHook(
      () => useUpdateAllocationAgreement({ complianceReportId: '123' }),
      { wrapper }
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

  it('should provide mutation function for delete operations', () => {
    const { result } = renderHook(
      () => useDeleteAllocationAgreement({ complianceReportId: '123' }),
      { wrapper }
    )

    expect(result.current.mutate).toBeDefined()
    expect(typeof result.current.mutate).toBe('function')
    expect(result.current.isIdle).toBe(true)
  })

  it('should handle API errors in delete operations', async () => {
    const mockError = new Error('Delete failed')
    mockDelete.mockRejectedValueOnce(mockError)

    const { result } = renderHook(
      () => useDeleteAllocationAgreement({ complianceReportId: '123' }),
      { wrapper }
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

  it('should provide mutation function for import operations', () => {
    const { result } = renderHook(() => useImportAllocationAgreement('123'), {
      wrapper
    })

    expect(result.current.mutate).toBeDefined()
    expect(typeof result.current.mutate).toBe('function')
    expect(result.current.isIdle).toBe(true)
  })

  it('should handle API errors in import operations', async () => {
    const mockError = new Error('Import failed')
    mockPost.mockRejectedValueOnce(mockError)

    const { result } = renderHook(() => useImportAllocationAgreement('123'), {
      wrapper
    })

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

  it('should fetch job status successfully', async () => {
    const mockData = { status: 'completed', progress: 100 }
    mockGet.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () => useGetAllocationAgreementImportJobStatus('job-123'),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockData)
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('job-123'))
  })

  it('should not fetch when job ID is missing', () => {
    const { result } = renderHook(
      () => useGetAllocationAgreementImportJobStatus(null),
      { wrapper }
    )

    expect(result.current.isLoading).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('should handle fetch errors when job ID is provided', async () => {
    const mockError = new Error('API Error')
    mockGet.mockRejectedValue(mockError)

    const { result } = renderHook(
      () =>
        useGetAllocationAgreementImportJobStatus('job-123', { retry: false }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 2000
    })
    expect(result.current.error).toEqual(mockError)
  })
})
