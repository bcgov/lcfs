import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import {
  useDirectorReviewCounts,
  useTransactionCounts,
  useOrgTransactionCounts,
  useOrgComplianceReportCounts
} from '@/hooks/useDashboard'
import { useApiService } from '@/services/useApiService'

vi.mock('@/services/useApiService')

// Custom render function with QueryClientProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useDirectorReviewCounts', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  it('fetches the director review counts successfully', async () => {
    mockGet.mockResolvedValueOnce({
      data: { review_counts: 10 },
    })

    const { result } = renderHook(() => useDirectorReviewCounts(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ review_counts: 10 })
    expect(mockGet).toHaveBeenCalledWith('/dashboard/director-review-counts/')
  })

  it('handles errors correctly', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useDirectorReviewCounts(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual(new Error('Failed to fetch'))
  })
})

describe('useTransactionCounts', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  it('fetches the transaction counts successfully', async () => {
    mockGet.mockResolvedValueOnce({
      data: { transaction_counts: 20 },
    })

    const { result } = renderHook(() => useTransactionCounts(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ transaction_counts: 20 })
    expect(mockGet).toHaveBeenCalledWith('/dashboard/transaction-counts')
  })

  it('handles errors correctly', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useTransactionCounts(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual(new Error('Failed to fetch'))
  })
})

describe('useOrgTransactionCounts', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  it('fetches the org transaction counts successfully', async () => {
    mockGet.mockResolvedValueOnce({
      data: { org_transaction_counts: 30 },
    })

    const { result } = renderHook(() => useOrgTransactionCounts(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ org_transaction_counts: 30 })
    expect(mockGet).toHaveBeenCalledWith('/dashboard/org-transaction-counts')
  })

  it('handles errors correctly', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useOrgTransactionCounts(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual(new Error('Failed to fetch'))
  })
})

describe('useOrgComplianceReportCounts', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  it('fetches the org compliance report counts successfully', async () => {
    mockGet.mockResolvedValueOnce({
      data: { org_compliance_report_counts: 40 },
    })

    const { result } = renderHook(() => useOrgComplianceReportCounts(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ org_compliance_report_counts: 40 })
    expect(mockGet).toHaveBeenCalledWith('/dashboard/org-compliance-report-counts')
  })

  it('handles errors correctly', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useOrgComplianceReportCounts(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual(new Error('Failed to fetch'))
  })
})
