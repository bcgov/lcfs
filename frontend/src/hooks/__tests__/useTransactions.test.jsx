import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import {
  useTransactionsOrgTransfersInProgress,
  useTransactionsTransfersInProgress,
  useTransactionsInitiativeAgreementsInProgress,
  useTransactionsAdminAdjustmentsInProgress
} from '../useTransactions'
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

describe('useTransactionsOrgTransfersInProgress', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  it('fetches the transfers in progress successfully', async () => {
    mockGet.mockResolvedValueOnce({
      data: { transfers_in_progress: 5 },
    })

    const { result } = renderHook(() => useTransactionsOrgTransfersInProgress(1), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ transfers_in_progress: 5 })
    expect(mockGet).toHaveBeenCalledWith('/organization/1/count-transfers-in-progress')
  })

  it('handles errors correctly', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useTransactionsOrgTransfersInProgress(1), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual(new Error('Failed to fetch'))
  })
})

describe('useTransactionsTransfersInProgress', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  it('fetches the transfers in progress successfully', async () => {
    mockGet.mockResolvedValueOnce({
      data: { transfers_in_progress: 5 },
    })

    const { result } = renderHook(() => useTransactionsTransfersInProgress(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ transfers_in_progress: 5 })
    expect(mockGet).toHaveBeenCalledWith('/transactions/count-transfers-in-progress')
  })

  it('handles errors correctly', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useTransactionsTransfersInProgress(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual(new Error('Failed to fetch'))
  })
})

describe('useTransactionsInitiativeAgreementsInProgress', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  it('fetches the initiative agreements in progress successfully', async () => {
    mockGet.mockResolvedValueOnce({
      data: { initiative_agreements_in_progress: 3 },
    })

    const { result } = renderHook(() => useTransactionsInitiativeAgreementsInProgress(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ initiative_agreements_in_progress: 3 })
    expect(mockGet).toHaveBeenCalledWith('/transactions/count-initiative-agreements-in-progress')
  })

  it('handles errors correctly', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useTransactionsInitiativeAgreementsInProgress(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual(new Error('Failed to fetch'))
  })
})

describe('useTransactionsAdminAdjustmentsInProgress', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  it('fetches the admin adjustments in progress successfully', async () => {
    mockGet.mockResolvedValueOnce({
      data: { admin_adjustments_in_progress: 2 },
    })

    const { result } = renderHook(() => useTransactionsAdminAdjustmentsInProgress(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ admin_adjustments_in_progress: 2 })
    expect(mockGet).toHaveBeenCalledWith('/transactions/count-admin-adjustments-in-progress')
  })

  it('handles errors correctly', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useTransactionsAdminAdjustmentsInProgress(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual(new Error('Failed to fetch'))
  })
})
