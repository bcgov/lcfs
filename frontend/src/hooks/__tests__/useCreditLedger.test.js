import { waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, vi } from 'vitest'
import {
  useCreditLedger,
  usePeriodCreditLedger,
  useDownloadCreditLedger,
  useDownloadPeriodCreditLedger,
  useCreditLedgerYears
} from '@/hooks/useCreditLedger'
import { useApiService } from '@/services/useApiService'
import { test } from '@/tests/utils/fixtures'

vi.mock('@/services/useApiService')

describe('useCreditLedger', () => {
  const mockPost = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ post: mockPost })
  })

  test('should fetch credit ledger successfully with all parameters', async ({
    renderHook,
    query
  }) => {
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

    const { result } = renderHook(() => useCreditLedger(params), [query])

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

  test('should fetch credit ledger with default parameters', async ({
    renderHook,
    query
  }) => {
    const mockData = { transactions: [], totalCount: 0 }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () => useCreditLedger({ orgId: '123' }),
      [query]
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockData)
    expect(mockPost).toHaveBeenCalledWith(expect.stringContaining('123'), {
      page: 1,
      size: 10,
      sortOrders: [],
      filters: []
    })
  })

  test('should add period filter when period is provided', async ({
    renderHook,
    query
  }) => {
    const mockData = { transactions: [], totalCount: 0 }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () => useCreditLedger({ orgId: '123', period: '2023' }),
      [query]
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

  test('should combine period filter with extra filters', async ({
    renderHook,
    query
  }) => {
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
      [query]
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

  test('should not fetch when orgId is missing', ({ renderHook, query }) => {
    const { result } = renderHook(
      () => useCreditLedger({ orgId: null }),
      [query]
    )

    expect(result.current.isLoading).toBe(false)
    expect(mockPost).not.toHaveBeenCalled()
  })

  test('should be disabled when orgId is empty', ({ renderHook, query }) => {
    const { result } = renderHook(() => useCreditLedger({ orgId: '' }), [query])

    expect(result.current.isLoading).toBe(false)
    expect(mockPost).not.toHaveBeenCalled()
  })

  test('should handle API errors', async ({ renderHook, query }) => {
    const mockError = new Error('API Error')
    mockPost.mockRejectedValueOnce(mockError)

    const { result } = renderHook(
      () => useCreditLedger({ orgId: '123' }),
      [query]
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(mockError)
  })

  test('should pass through custom options', async ({ renderHook, query }) => {
    const mockData = { transactions: [], totalCount: 0 }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const customOptions = {
      enabled: true,
      staleTime: 30000,
      retry: 1
    }

    const { result } = renderHook(
      () => useCreditLedger({ orgId: '123' }, customOptions),
      [query]
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockData)
  })

  test('should handle pagination parameters correctly', async ({
    renderHook,
    query
  }) => {
    const mockData = { transactions: [], totalCount: 100 }
    mockPost.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () =>
        useCreditLedger({
          orgId: '123',
          page: 3,
          size: 25
        }),
      [query]
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

  test('should handle sort orders correctly', async ({ renderHook, query }) => {
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
      [query]
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

describe('usePeriodCreditLedger', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  test('fetches the period ledger with the include_pending param', async ({
    renderHook,
    query
  }) => {
    const mockData = { compliancePeriod: 2024, transactions: [] }
    mockGet.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(
      () =>
        usePeriodCreditLedger({
          orgId: 123,
          complianceYear: 2024,
          includePending: true
        }),
      [query]
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockData)
    expect(mockGet).toHaveBeenCalledWith(
      '/credit-ledger/organization/123/period/2024',
      { params: { include_pending: true } }
    )
  })

  test('defaults include_pending to false', async ({ renderHook, query }) => {
    mockGet.mockResolvedValueOnce({ data: {} })
    const { result } = renderHook(
      () => usePeriodCreditLedger({ orgId: 5, complianceYear: 2023 }),
      [query]
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith(
      '/credit-ledger/organization/5/period/2023',
      { params: { include_pending: false } }
    )
  })

  test('does not fetch until org and year are present', ({
    renderHook,
    query
  }) => {
    const { result } = renderHook(
      () => usePeriodCreditLedger({ orgId: null, complianceYear: 2024 }),
      [query]
    )
    expect(result.current.isLoading).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })
})

describe('useDownloadCreditLedger', () => {
  const mockDownload = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ download: mockDownload })
  })

  test('should return a download function', () => {
    const downloadFn = useDownloadCreditLedger()
    expect(typeof downloadFn).toBe('function')
  })

  test('should call download with correct parameters for xlsx format', () => {
    const downloadFn = useDownloadCreditLedger()

    downloadFn({
      orgId: '123',
      format: 'xlsx'
    })

    expect(mockDownload).toHaveBeenCalledWith({
      url: expect.stringContaining('123'),
      method: 'get',
      params: {
        format: 'xlsx'
      }
    })
  })

  test('should call download with default format when not specified', () => {
    const downloadFn = useDownloadCreditLedger()

    downloadFn({
      orgId: '123'
    })

    expect(mockDownload).toHaveBeenCalledWith({
      url: expect.stringContaining('123'),
      method: 'get',
      params: {
        format: 'xlsx'
      }
    })
  })

  test('should call download without compliance year when not provided', () => {
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

  test('should handle different formats', () => {
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

  it('should ignore compliance year so filtered dashboards download the full ledger', () => {
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
        format: 'xlsx'
      }
    })
  })

  test('should pass through API options', () => {
    const apiOptions = { timeout: 30000 }
    const downloadFn = useDownloadCreditLedger(apiOptions)

    expect(vi.mocked(useApiService)).toHaveBeenCalledWith(apiOptions)
  })

  test('should handle missing orgId in download parameters', () => {
    const downloadFn = useDownloadCreditLedger()

    downloadFn({
      complianceYear: '2024',
      format: 'xlsx'
    })

    // Should still call download even with undefined orgId
    expect(mockDownload).toHaveBeenCalledWith({
      url: expect.stringContaining('/credit-ledger/organization//'),
      method: 'get',
      params: {
        format: 'xlsx'
      }
    })
  })
})

describe('useCreditLedgerYears', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  test('should fetch organization years successfully', async ({
    renderHook,
    query
  }) => {
    const mockYears = ['2024', '2023', '2022']
    mockGet.mockResolvedValueOnce({ data: mockYears })

    const { result } = renderHook(() => useCreditLedgerYears(123), [query])

    await waitFor(() => {
      expect(result.current.data).toEqual(mockYears)
    })

    expect(mockGet).toHaveBeenCalledWith(
      '/credit-ledger/organization/123/years'
    )
  })

  test('should not fetch when orgId is not provided', ({
    renderHook,
    query
  }) => {
    const { result } = renderHook(() => useCreditLedgerYears(null), [query])

    expect(result.current.isLoading).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('should handle empty years list', async ({ renderHook, query }) => {
    mockGet.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useCreditLedgerYears(456), [query])

    await waitFor(() => {
      expect(result.current.data).toEqual([])
    })

    expect(mockGet).toHaveBeenCalledWith(
      '/credit-ledger/organization/456/years'
    )
  })

  test('should handle API errors gracefully', async ({ renderHook, query }) => {
    const mockError = new Error('API Error')
    mockGet.mockRejectedValueOnce(mockError)

    const { result } = renderHook(() => useCreditLedgerYears(123), [query])

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(mockError)
  })

  test('should pass through custom options', async ({ renderHook, query }) => {
    const mockYears = ['2024']
    mockGet.mockResolvedValueOnce({ data: mockYears })

    const customOptions = {
      enabled: true,
      staleTime: 60000
    }

    const { result } = renderHook(
      () => useCreditLedgerYears(123, customOptions),
      [query]
    )

    await waitFor(() => {
      expect(result.current.data).toEqual(mockYears)
    })
  })
})

describe('useDownloadPeriodCreditLedger', () => {
  const mockDownload = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ download: mockDownload })
  })

  it('hits the period export endpoint for the requested year', () => {
    // #4832: the period export must go through the period route so the
    // spreadsheet uses the same April-March envelope as the ledger view.
    useDownloadPeriodCreditLedger()({ orgId: '123', complianceYear: 2024 })

    expect(mockDownload).toHaveBeenCalledWith({
      url: '/credit-ledger/organization/123/period/2024/export',
      method: 'get',
      params: { include_pending: false, format: 'xlsx' }
    })
  })

  it('passes the pending flag and format through', () => {
    useDownloadPeriodCreditLedger()({
      orgId: 7,
      complianceYear: 2023,
      includePending: true,
      format: 'csv'
    })

    expect(mockDownload).toHaveBeenCalledWith({
      url: '/credit-ledger/organization/7/period/2023/export',
      method: 'get',
      params: { include_pending: true, format: 'csv' }
    })
  })
})
