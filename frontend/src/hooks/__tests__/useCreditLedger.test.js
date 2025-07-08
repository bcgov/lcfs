import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useCreditLedger,
  useDownloadCreditLedger
} from '@/hooks/useCreditLedger'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('@/services/useApiService')

describe('useCreditLedger', () => {
  const mockPost = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ post: mockPost })
  })

  it('should fetch credit ledger successfully with all parameters', async () => {
    const mockData = {
      transactions: [
        { id: 1, credits: 100, type: 'allocation' },
        { id: 2, credits: -50, type: 'transfer' }
      ],
      totalCount: 2
    }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const params = {
      orgId: '123',
      page: 1,
      size: 10,
      period: '2024',
      sortOrders: [{ field: 'created_date', direction: 'desc' }],
      extraFilters: [{ field: 'type', filter: 'allocation', type: 'equals' }]
    }

    const { result } = renderHook(() => useCreditLedger(params), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockData)
    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining('123'),
      expect.objectContaining({
        page: 1,
        size: 10,
        sortOrders: [{ field: 'created_date', direction: 'desc' }],
        filters: expect.arrayContaining([
          { field: 'type', filter: 'allocation', type: 'equals' },
          {
            field: 'compliance_period',
            filter: '2024',
            type: 'equals',
            filterType: 'text'
          }
        ])
      })
    )
  })

  it('should fetch credit ledger with default parameters', async () => {
    const mockData = { transactions: [], totalCount: 0 }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(() => useCreditLedger({ orgId: '123' }), {
      wrapper
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockData)
    expect(mockPost).toHaveBeenCalledWith(expect.stringContaining('123'), {
      page: 1,
      size: 10,
      sortOrders: [],
      filters: []
    })
  })

  it('should add period filter when period is provided', async () => {
    const mockData = { transactions: [], totalCount: 0 }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () => useCreditLedger({ orgId: '123', period: '2023' }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining('123'),
      expect.objectContaining({
        filters: [
          {
            field: 'compliance_period',
            filter: '2023',
            type: 'equals',
            filterType: 'text'
          }
        ]
      })
    )
  })

  it('should combine period filter with extra filters', async () => {
    const mockData = { transactions: [], totalCount: 0 }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const extraFilters = [
      { field: 'organization', filter: 'test-org', type: 'contains' }
    ]

    const { result } = renderHook(
      () =>
        useCreditLedger({
          orgId: '123',
          period: '2023',
          extraFilters
        }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining('123'),
      expect.objectContaining({
        filters: [
          { field: 'organization', filter: 'test-org', type: 'contains' },
          {
            field: 'compliance_period',
            filter: '2023',
            type: 'equals',
            filterType: 'text'
          }
        ]
      })
    )
  })

  it('should not fetch when orgId is missing', () => {
    const { result } = renderHook(() => useCreditLedger({ orgId: null }), {
      wrapper
    })

    expect(result.current.isLoading).toBe(false)
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('should be disabled when orgId is empty', () => {
    const { result } = renderHook(() => useCreditLedger({ orgId: '' }), {
      wrapper
    })

    expect(result.current.isLoading).toBe(false)
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('should handle API errors', async () => {
    const mockError = new Error('API Error')
    mockPost.mockRejectedValueOnce(mockError)

    const { result } = renderHook(() => useCreditLedger({ orgId: '123' }), {
      wrapper
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(mockError)
  })

  it('should pass through custom options', async () => {
    const mockData = { transactions: [], totalCount: 0 }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const customOptions = {
      enabled: true,
      staleTime: 30000,
      retry: 1
    }

    const { result } = renderHook(
      () => useCreditLedger({ orgId: '123' }, customOptions),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockData)
  })

  it('should handle pagination parameters correctly', async () => {
    const mockData = { transactions: [], totalCount: 100 }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () =>
        useCreditLedger({
          orgId: '123',
          page: 3,
          size: 25
        }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining('123'),
      expect.objectContaining({
        page: 3,
        size: 25,
        sortOrders: [],
        filters: []
      })
    )
  })

  it('should handle sort orders correctly', async () => {
    const mockData = { transactions: [], totalCount: 0 }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const sortOrders = [
      { field: 'created_date', direction: 'desc' },
      { field: 'credits', direction: 'asc' }
    ]

    const { result } = renderHook(
      () =>
        useCreditLedger({
          orgId: '123',
          sortOrders
        }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining('123'),
      expect.objectContaining({
        sortOrders
      })
    )
  })
})

describe('useDownloadCreditLedger', () => {
  const mockDownload = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ download: mockDownload })
  })

  it('should return a download function', () => {
    const downloadFn = useDownloadCreditLedger()
    expect(typeof downloadFn).toBe('function')
  })

  it('should call download with correct parameters for xlsx format', () => {
    const downloadFn = useDownloadCreditLedger()

    downloadFn({
      orgId: '123',
      complianceYear: '2024',
      format: 'xlsx'
    })

    expect(mockDownload).toHaveBeenCalledWith({
      url: expect.stringContaining('123'),
      method: 'get',
      params: {
        compliance_year: '2024',
        format: 'xlsx'
      }
    })
  })

  it('should call download with default format when not specified', () => {
    const downloadFn = useDownloadCreditLedger()

    downloadFn({
      orgId: '123',
      complianceYear: '2024'
    })

    expect(mockDownload).toHaveBeenCalledWith({
      url: expect.stringContaining('123'),
      method: 'get',
      params: {
        compliance_year: '2024',
        format: 'xlsx'
      }
    })
  })

  it('should call download without compliance year when not provided', () => {
    const downloadFn = useDownloadCreditLedger()

    downloadFn({
      orgId: '123',
      format: 'csv'
    })

    expect(mockDownload).toHaveBeenCalledWith({
      url: expect.stringContaining('123'),
      method: 'get',
      params: {
        format: 'csv'
      }
    })
  })

  it('should handle different formats', () => {
    const downloadFn = useDownloadCreditLedger()

    downloadFn({
      orgId: '123',
      complianceYear: '2024',
      format: 'csv'
    })

    expect(mockDownload).toHaveBeenCalledWith({
      url: expect.stringContaining('123'),
      method: 'get',
      params: {
        compliance_year: '2024',
        format: 'csv'
      }
    })
  })

  it('should pass through API options', () => {
    const apiOptions = { timeout: 30000 }
    const downloadFn = useDownloadCreditLedger(apiOptions)

    expect(vi.mocked(useApiService)).toHaveBeenCalledWith(apiOptions)
  })

  it('should handle missing orgId in download parameters', () => {
    const downloadFn = useDownloadCreditLedger()

    downloadFn({
      complianceYear: '2024',
      format: 'xlsx'
    })

    // Should still call download even with undefined orgId
    expect(mockDownload).toHaveBeenCalledWith({
      url: expect.stringContaining('undefined'),
      method: 'get',
      params: {
        compliance_year: '2024',
        format: 'xlsx'
      }
    })
  })
})
