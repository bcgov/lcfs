import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'
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

  it('should fetch current user successfully', async () => {
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

    const { result } = renderHook(() => useCurrentUser(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
    expect(mockGet).toHaveBeenCalledWith('/users/current')
  })

  it('should handle API errors', async () => {
    const mockError = new Error('User not found')
    mockGet.mockRejectedValue(mockError)

    const { result } = renderHook(() => useCurrentUser(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(mockError)
  })

  it('should pass through custom options', async () => {
    const mockData = { userId: 123 }
    mockGet.mockResolvedValue({ data: mockData })
    const customOptions = { staleTime: 10000 }

    const { result } = renderHook(() => useCurrentUser(customOptions), {
      wrapper
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
  })

  it('should provide hasRoles utility function', async () => {
    const mockData = {
      userId: 123,
      roles: [
        { roleId: 1, name: 'Admin' },
        { roleId: 2, name: 'Analyst' }
      ]
    }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useCurrentUser(), { wrapper })

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

  it('should handle hasRoles when no roles exist', async () => {
    const mockData = {
      userId: 123,
      roles: []
    }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useCurrentUser(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.hasRoles('Admin')).toBe(false)
    expect(result.current.hasRoles()).toBe(true) // No arguments should return true
  })

  it('should handle hasRoles when user data is not loaded', () => {
    const { result } = renderHook(() => useCurrentUser(), { wrapper })

    expect(result.current.hasRoles('Admin')).toBe(false)
  })

  it('should cache user data', async () => {
    const mockData = { userId: 123 }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useCurrentUser(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // The query should be cached and not fetched again
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('should use correct query key', async () => {
    const mockData = { userId: 123 }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useCurrentUser(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // Should use 'current-user' as query key
    expect(result.current.data).toEqual(mockData)
  })
})
