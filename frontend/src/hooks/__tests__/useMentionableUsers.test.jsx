import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useMentionableUsers } from '../useMentionableUsers'

const mockApiService = {
  get: vi.fn()
}

vi.mock('@/services/useApiService', () => ({
  useApiService: () => mockApiService
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useMentionableUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not query the API when disabled', () => {
    renderHook(() => useMentionableUsers('jane', false), {
      wrapper: createWrapper()
    })

    expect(mockApiService.get).not.toHaveBeenCalled()
  })

  it('queries the mentionable-users endpoint with the encoded query when enabled', async () => {
    const mockUsers = [
      {
        userProfileId: 5,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@gov.bc.ca',
        displayName: 'Jane Doe'
      }
    ]
    mockApiService.get.mockResolvedValue({ data: mockUsers })

    const { result } = renderHook(() => useMentionableUsers('jane doe', true), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.data).toEqual(mockUsers)
    })

    expect(mockApiService.get).toHaveBeenCalledWith(
      '/internal_comments/mentionable-users?q=jane%20doe'
    )
  })
})
