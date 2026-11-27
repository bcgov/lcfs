import { test } from '@/tests/utils/fixtures'
import { waitFor } from '@testing-library/react'
import { describe, expect, vi, beforeEach } from 'vite-plus/test'
import { useApiService } from '@/services/useApiService'
import axios from 'axios'
import type { ApiServiceInstance } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'
import {
  useTransaction,
  useTransactionStatuses,
  useGetTransactionList,
  useTransactionDocuments,
  useDownloadTransactions
} from '../useTransactions'
import * as currentUserHooks from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'
import { TRANSFER_STATUSES } from '@/constants/statuses'

vi.mock('@/services/useApiService')
vi.mock('@/hooks/useCurrentUser')

const apiService = (
  overrides: Partial<ApiServiceInstance>
): ApiServiceInstance =>
  Object.assign(axios.create(), { download: vi.fn() }, overrides)

const mockCurrentUser = (hasRole: (role: string) => boolean) => {
  vi.mocked(currentUserHooks.useCurrentUser).mockImplementation(() => {
    const query = useQuery({
      queryKey: ['test-current-user'],
      queryFn: async () => ({}),
      initialData: {}
    })
    return {
      ...query,
      hasRoles: hasRole,
      hasAnyRole: hasRole,
      sameOrganization: () => false,
      fullName: () => ''
    }
  })
}

describe('useTransaction', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue(apiService({ get: mockGet }))
  })

  test('fetches a single transaction by ID', async ({ renderHook, query }) => {
    const mockTxn = { transactionId: 42, status: 'Recorded' }
    mockGet.mockResolvedValue({ data: mockTxn })

    const { result } = renderHook(() => useTransaction(42, {}), [query])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockTxn)
    expect(mockGet).toHaveBeenCalledWith('/transactions/42')
  })

  test('handles API errors gracefully', async ({ renderHook, query }) => {
    mockGet.mockRejectedValue(new Error('Not found'))

    const { result } = renderHook(
      () => useTransaction(999, { retry: false }),
      [query]
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error!.message).toBe('Not found')
  })
})

describe('useTransactionStatuses', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue(apiService({ get: mockGet }))
  })

  test('returns all statuses for a government user (no RECOMMENDED, no DELETED/SENT filter)', async ({
    renderHook,
    query
  }) => {
    const statuses = [
      { status: TRANSFER_STATUSES.RECORDED },
      { status: TRANSFER_STATUSES.RECOMMENDED },
      { status: TRANSFER_STATUSES.DELETED }
    ]
    mockGet.mockResolvedValue({ data: statuses })
    mockCurrentUser(() => false)

    const { result } = renderHook(() => useTransactionStatuses({}), [query])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Government users see everything except DELETED and SENT
    expect(result.current.data).not.toContainEqual({
      status: TRANSFER_STATUSES.DELETED
    })
  })

  test('excludes RECOMMENDED status for supplier users', async ({
    renderHook,
    query
  }) => {
    const statuses = [
      { status: TRANSFER_STATUSES.RECORDED },
      { status: TRANSFER_STATUSES.RECOMMENDED },
      { status: 'Draft' }
    ]
    mockGet.mockResolvedValue({ data: statuses })
    mockCurrentUser((role) => role === roles.supplier)

    const { result } = renderHook(() => useTransactionStatuses({}), [query])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).not.toContainEqual({
      status: TRANSFER_STATUSES.RECOMMENDED
    })
    expect(result.current.data).toContainEqual({
      status: TRANSFER_STATUSES.RECORDED
    })
  })

  test('excludes DELETED and SENT statuses for non-supplier users', async ({
    renderHook,
    query
  }) => {
    const statuses = [
      { status: TRANSFER_STATUSES.DELETED },
      { status: TRANSFER_STATUSES.SENT },
      { status: TRANSFER_STATUSES.RECORDED }
    ]
    mockGet.mockResolvedValue({ data: statuses })
    mockCurrentUser(() => false)

    const { result } = renderHook(() => useTransactionStatuses({}), [query])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([
      { status: TRANSFER_STATUSES.RECORDED }
    ])
  })
})

describe('useGetTransactionList', () => {
  const mockPost = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue(apiService({ post: mockPost }))
    mockCurrentUser(() => false)
  })

  test('calls the generic transactions endpoint for government users', async ({
    renderHook,
    query
  }) => {
    const responseData = { transactions: [], total: 0 }
    mockPost.mockResolvedValue({ data: responseData })

    const { result } = renderHook(
      () => useGetTransactionList({ page: 1, size: 10 }, {}),
      [query]
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith(
      '/transactions/',
      expect.objectContaining({ page: 1, size: 10 })
    )
  })

  test('calls the org transactions endpoint for supplier users', async ({
    renderHook,
    query
  }) => {
    mockCurrentUser((role) => role === roles.supplier)
    mockPost.mockResolvedValue({ data: [] })

    const { result } = renderHook(
      () => useGetTransactionList({ page: 1, size: 5 }, {}),
      [query]
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith(
      '/organization/transactions',
      expect.objectContaining({ page: 1, size: 5 })
    )
  })

  test('calls the org-filtered endpoint when selectedOrgId is provided', async ({
    renderHook,
    query
  }) => {
    mockPost.mockResolvedValue({ data: [] })

    const { result } = renderHook(
      () => useGetTransactionList({ page: 1, size: 10, selectedOrgId: 7 }, {}),
      [query]
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/transactions/7', expect.any(Object))
  })
})

describe('useTransactionDocuments', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue(apiService({ get: mockGet }))
  })

  test('fetches documents for the given parent', async ({
    renderHook,
    query
  }) => {
    const docs = [{ documentId: 1, fileName: 'report.pdf' }]
    mockGet.mockResolvedValue({ data: docs })

    const { result } = renderHook(
      () => useTransactionDocuments(10, 'transfer', {}),
      [query]
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(docs)
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('10'))
  })
})

describe('useDownloadTransactions', () => {
  const mockDownload = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue(
      apiService({ download: mockDownload })
    )
  })

  test('exposes a mutate function', ({ renderHook, query }) => {
    const { result } = renderHook(() => useDownloadTransactions({}), [query])
    expect(typeof result.current.mutate).toBe('function')
  })

  test('calls download with the correct parameters when mutated', async ({
    renderHook,
    query
  }) => {
    mockDownload.mockResolvedValue(new Blob(['data']))

    const { result } = renderHook(() => useDownloadTransactions({}), [query])

    result.current.mutate({
      format: 'csv',
      body: { filters: [] },
      endpoint: '/transactions/export'
    })

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledWith({
        url: '/transactions/export',
        method: 'post',
        params: { format: 'csv' },
        data: { filters: [] }
      })
    })
  })
})
