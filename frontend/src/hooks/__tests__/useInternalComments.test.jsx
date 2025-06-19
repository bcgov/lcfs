import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useInternalComments } from '../useInternalComments'

// Mock the API service
const mockApiService = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}

vi.mock('@/services/useApiService', () => ({
  useApiService: () => mockApiService
}))

// Mock useCurrentUser hook
const mockHasAnyRole = vi.fn()
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    hasAnyRole: mockHasAnyRole
  })
}))

// Mock roles constants
vi.mock('@/constants/roles', () => ({
  roles: {
    director: 'director',
    analyst: 'analyst',
    compliance_manager: 'compliance_manager'
  }
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

describe('useInternalComments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasAnyRole.mockReturnValue(false)
  })

  describe('Comments fetching', () => {
    it('should fetch internal comments successfully with director role', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const mockComments = [
        {
          internalCommentId: 2,
          comment: 'Latest comment',
          audience_scope: 'Director'
        },
        {
          internalCommentId: 1,
          comment: 'First comment',
          audience_scope: 'Director'
        }
      ]
      mockApiService.get.mockResolvedValue({ data: mockComments })

      const { result } = renderHook(
        () => useInternalComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.comments).toEqual(mockComments)
      })

      expect(result.current.comments).toEqual(mockComments)
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/internal_comments/compliance_report/123'
      )
    })

    it('should fetch internal comments with analyst role', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'analyst')

      const mockComments = [
        {
          internalCommentId: 1,
          comment: 'Analyst comment',
          audience_scope: 'Analyst'
        }
      ]
      mockApiService.get.mockResolvedValue({ data: mockComments })

      const { result } = renderHook(
        () => useInternalComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.comments).toEqual(mockComments)
      })

      expect(result.current.comments).toEqual(mockComments)
    })

    it('should fetch internal comments with compliance manager role', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'compliance_manager')

      const mockComments = [
        {
          internalCommentId: 1,
          comment: 'Manager comment',
          audience_scope: 'Compliance Manager'
        }
      ]
      mockApiService.get.mockResolvedValue({ data: mockComments })

      const { result } = renderHook(
        () => useInternalComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.comments).toEqual(mockComments)
      })

      expect(result.current.comments).toEqual(mockComments)
    })

    it('should sort comments in descending order by default', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const mockComments = [
        { internalCommentId: 1, comment: 'First comment' },
        { internalCommentId: 3, comment: 'Third comment' },
        { internalCommentId: 2, comment: 'Second comment' }
      ]
      const expectedSorted = [
        { internalCommentId: 3, comment: 'Third comment' },
        { internalCommentId: 2, comment: 'Second comment' },
        { internalCommentId: 1, comment: 'First comment' }
      ]
      mockApiService.get.mockResolvedValue({ data: mockComments })

      const { result } = renderHook(
        () => useInternalComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.comments).toEqual(expectedSorted)
      })

      expect(result.current.comments).toEqual(expectedSorted)
    })

    it('should sort comments in ascending order when specified', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const mockComments = [
        { internalCommentId: 3, comment: 'Third comment' },
        { internalCommentId: 1, comment: 'First comment' },
        { internalCommentId: 2, comment: 'Second comment' }
      ]
      const expectedSorted = [
        { internalCommentId: 1, comment: 'First comment' },
        { internalCommentId: 2, comment: 'Second comment' },
        { internalCommentId: 3, comment: 'Third comment' }
      ]
      mockApiService.get.mockResolvedValue({ data: mockComments })

      const { result } = renderHook(
        () =>
          useInternalComments('compliance_report', 123, { sortOrder: 'asc' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.comments).toEqual(expectedSorted)
      })

      expect(result.current.comments).toEqual(expectedSorted)
    })

    it('should not fetch when entityId is missing', () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const { result } = renderHook(
        () => useInternalComments('compliance_report', null),
        { wrapper: createWrapper() }
      )

      expect(result.current.isLoading).toBe(false)
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should not fetch when entityType is missing', () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const { result } = renderHook(() => useInternalComments(null, 123), {
        wrapper: createWrapper()
      })

      expect(result.current.isLoading).toBe(false)
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle enabled option', () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const { result } = renderHook(
        () => useInternalComments('compliance_report', 123, { enabled: false }),
        { wrapper: createWrapper() }
      )

      expect(result.current.isLoading).toBe(false)
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle autoFetch option', () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const { result } = renderHook(
        () =>
          useInternalComments('compliance_report', 123, { autoFetch: false }),
        { wrapper: createWrapper() }
      )

      expect(result.current.isLoading).toBe(false)
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')
      const mockError = new Error('Failed to fetch comments')
      mockApiService.get.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useInternalComments('compliance_report', 123, { retry: 0 }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('Adding comments', () => {
    it('should add comment successfully with director role', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')
      const mockNewComment = {
        internalCommentId: 123,
        comment: 'New comment',
        audience_scope: 'Director'
      }
      mockApiService.post.mockResolvedValue({ data: mockNewComment })

      const { result } = renderHook(
        () => useInternalComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      await act(async () => {
        result.current.handleCommentInputChange('New comment')
      })

      await act(async () => {
        await result.current.addComment()
      })

      expect(mockApiService.post).toHaveBeenCalledWith('/internal_comments/', {
        entityType: 'compliance_report',
        entityId: 123,
        comment: 'New comment',
        audience_scope: 'Director'
      })
    })

    it('should handle comment input state', () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const { result } = renderHook(
        () => useInternalComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.handleCommentInputChange('Test comment')
      })

      expect(result.current.commentInput).toBe('Test comment')
    })

    it('should clear comment input after successful addition', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')
      const mockNewComment = {
        internalCommentId: 123,
        comment: 'Test comment',
        audience_scope: 'Director'
      }
      mockApiService.post.mockResolvedValue({ data: mockNewComment })

      const { result } = renderHook(
        () => useInternalComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.handleCommentInputChange('Test comment')
      })

      expect(result.current.commentInput).toBe('Test comment')

      await act(async () => {
        await result.current.addComment()
      })

      await waitFor(() => {
        expect(result.current.commentInput).toBe('')
      })
    })

    it('should handle add comment errors', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')
      const mockError = new Error('Failed to add comment')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useInternalComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.handleCommentInputChange('New comment')
      })

      await act(async () => {
        try {
          await result.current.addComment()
        } catch (error) {
          // Expected to throw
        }
      })

      await waitFor(() => {
        expect(result.current.addError).toEqual(mockError)
      })
    })

    it('should not allow adding comments without proper role', async () => {
      mockHasAnyRole.mockReturnValue(false) // No valid role

      const { result } = renderHook(
        () => useInternalComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.handleCommentInputChange('New comment')
      })

      await act(async () => {
        try {
          await result.current.addComment()
        } catch (error) {
          // Expected to throw
        }
      })

      expect(mockApiService.post).not.toHaveBeenCalled()
    })

    it('should trim comment text before submission', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')
      const mockNewComment = {
        internalCommentId: 123,
        comment: 'Trimmed comment',
        audience_scope: 'Director'
      }
      mockApiService.post.mockResolvedValue({ data: mockNewComment })

      const { result } = renderHook(
        () => useInternalComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.handleCommentInputChange('  Trimmed comment  ')
      })

      await act(async () => {
        await result.current.addComment()
      })

      expect(mockApiService.post).toHaveBeenCalledWith('/internal_comments/', {
        entityType: 'compliance_report',
        entityId: 123,
        comment: 'Trimmed comment',
        audience_scope: 'Director'
      })
    })

    it('should reject empty comments', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const { result } = renderHook(
        () => useInternalComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.handleCommentInputChange('   ')
      })

      await act(async () => {
        await result.current.addComment()
      })

      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('Optimistic updates', () => {
    it('should perform optimistic updates when enabled', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      // Mock initial comments
      const mockComments = [
        { internalCommentId: 1, comment: 'Existing comment' }
      ]
      mockApiService.get.mockResolvedValue({ data: mockComments })

      const mockNewComment = {
        internalCommentId: 2,
        comment: 'New comment',
        audience_scope: 'Director'
      }
      mockApiService.post.mockResolvedValue({ data: mockNewComment })

      const { result } = renderHook(
        () =>
          useInternalComments('compliance_report', 123, {
            optimisticUpdates: true
          }),
        { wrapper: createWrapper() }
      )

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.comments).toEqual(mockComments)
      })

      act(() => {
        result.current.handleCommentInputChange('New comment')
      })

      await act(async () => {
        await result.current.addComment()
      })

      expect(mockApiService.post).toHaveBeenCalled()
    })

    it('should not perform optimistic updates when disabled', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      // Mock initial comments
      const mockComments = [
        { internalCommentId: 1, comment: 'Existing comment' }
      ]
      mockApiService.get.mockResolvedValue({ data: mockComments })

      const mockNewComment = {
        internalCommentId: 2,
        comment: 'New comment',
        audience_scope: 'Director'
      }
      mockApiService.post.mockResolvedValue({ data: mockNewComment })

      const { result } = renderHook(
        () =>
          useInternalComments('compliance_report', 123, {
            optimisticUpdates: false
          }),
        { wrapper: createWrapper() }
      )

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.comments).toEqual(mockComments)
      })

      act(() => {
        result.current.handleCommentInputChange('New comment')
      })

      await act(async () => {
        await result.current.addComment()
      })

      expect(mockApiService.post).toHaveBeenCalled()
    })
  })
})
