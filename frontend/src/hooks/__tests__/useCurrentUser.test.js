import { waitFor } from '@testing-library/react'
import { describe, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { test } from '@/tests/utils/fixtures'
import { useCurrentUser } from '../useCurrentUser'

vi.mock('@/services/useApiService')
vi.mock('@react-keycloak/web')
vi.mock('@/stores/useUserStore')

describe('useCurrentUser', () => {
  const mockGet = vi.fn()
  const mockSetUser = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({
      get: mockGet
    })

    // Mock useKeycloak
    const { useKeycloak } = await import('@react-keycloak/web')
    vi.mocked(useKeycloak).mockReturnValue({
      keycloak: {
        authenticated: true,
        token: 'mock-token'
      },
      initialized: true
    })

    // Mock useUserStore
    const { useUserStore } = await import('@/stores/useUserStore')
    vi.mocked(useUserStore).mockReturnValue(mockSetUser)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('should fetch current user successfully', async ({
    renderHook,
    query
  }) => {
    const mockData = {
      userId: 123,
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      organization: {
        organizationId: 1,
        name: 'Test Organization'
      },
      roles: [{ roleId: 1, name: 'Admin' }]
    }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useCurrentUser(), [query])

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
    expect(mockGet).toHaveBeenCalledWith('/users/current')
  })

  test('should handle API errors', async ({ renderHook, query }) => {
    const mockError = new Error('User not found')
    mockGet.mockRejectedValue(mockError)

    const { result } = renderHook(() => useCurrentUser(), [query])

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(mockError)
  })

  test('should pass through custom options', async ({ renderHook, query }) => {
    const mockData = { userId: 123 }
    mockGet.mockResolvedValue({ data: mockData })
    const customOptions = { staleTime: 10000 }

    const { result } = renderHook(() => useCurrentUser(customOptions), [query])

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
  })

  test('should provide hasRoles utility function', async ({
    renderHook,
    query
  }) => {
    const mockData = {
      userId: 123,
      roles: [
        { roleId: 1, name: 'Admin' },
        { roleId: 2, name: 'Analyst' }
      ]
    }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useCurrentUser(), [query])

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(typeof result.current.hasRoles).toBe('function')

    // Test hasRoles function
    expect(result.current.hasRoles('Admin')).toBe(true)
    expect(result.current.hasRoles('Analyst')).toBe(true)
    expect(result.current.hasRoles('Admin', 'Analyst')).toBe(true)
    expect(result.current.hasRoles('SuperAdmin')).toBe(false)
    expect(result.current.hasRoles('Admin', 'SuperAdmin')).toBe(false)
  })

  test('should handle hasRoles when no roles exist', async ({
    renderHook,
    query
  }) => {
    const mockData = {
      userId: 123,
      roles: []
    }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useCurrentUser(), [query])

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.hasRoles('Admin')).toBe(false)
    expect(result.current.hasRoles()).toBe(true) // No arguments should return true
  })

  test('should handle hasRoles when user data is not loaded', ({
    renderHook,
    query
  }) => {
    const { result } = renderHook(() => useCurrentUser(), [query])

    expect(result.current.hasRoles('Admin')).toBe(false)
  })

  test('should cache user data', async ({ renderHook, query }) => {
    const mockData = { userId: 123 }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useCurrentUser(), [query])

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // The query should be cached and not fetched again
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  test('should use correct query key', async ({ renderHook, query }) => {
    const mockData = { userId: 123 }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useCurrentUser(), [query])

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // Should use 'current-user' as query key
    expect(result.current.data).toEqual(mockData)
  })
})
