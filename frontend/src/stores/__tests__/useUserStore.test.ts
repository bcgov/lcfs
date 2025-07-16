import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useUserStore } from '../useUserStore'

describe('useUserStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useUserStore.setState({ user: null })
    })
  })

  describe('initial state', () => {
    it('should initialize with null user', () => {
      const { result } = renderHook(() => useUserStore())
      
      expect(result.current.user).toBeNull()
    })

    it('should have setUser function available', () => {
      const { result } = renderHook(() => useUserStore())
      
      expect(typeof result.current.setUser).toBe('function')
    })
  })

  describe('setUser functionality', () => {
    it('should set user data when setUser is called', () => {
      const { result } = renderHook(() => useUserStore())
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'ANALYST'
      }

      act(() => {
        result.current.setUser(mockUser)
      })

      expect(result.current.user).toEqual(mockUser)
    })

    it('should overwrite existing user data', () => {
      const { result } = renderHook(() => useUserStore())
      const firstUser = {
        id: 1,
        name: 'First User',
        email: 'first@example.com',
        role: 'ANALYST'
      }
      const secondUser = {
        id: 2,
        name: 'Second User',
        email: 'second@example.com',
        role: 'GOVERNMENT'
      }

      act(() => {
        result.current.setUser(firstUser)
      })
      
      expect(result.current.user).toEqual(firstUser)

      act(() => {
        result.current.setUser(secondUser)
      })

      expect(result.current.user).toEqual(secondUser)
    })

    it('should handle setting user to null', () => {
      const { result } = renderHook(() => useUserStore())
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'ANALYST'
      }

      // First set a user
      act(() => {
        result.current.setUser(mockUser)
      })
      
      expect(result.current.user).toEqual(mockUser)

      // Then clear the user
      act(() => {
        result.current.setUser(null)
      })

      expect(result.current.user).toBeNull()
    })

    it('should handle setting user to undefined', () => {
      const { result } = renderHook(() => useUserStore())
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'ANALYST'
      }

      // First set a user
      act(() => {
        result.current.setUser(mockUser)
      })
      
      expect(result.current.user).toEqual(mockUser)

      // Then set to undefined
      act(() => {
        result.current.setUser(undefined)
      })

      expect(result.current.user).toBeUndefined()
    })

    it('should handle partial user objects', () => {
      const { result } = renderHook(() => useUserStore())
      const partialUser = {
        id: 1,
        name: 'Partial User'
        // Missing email and role
      }

      act(() => {
        result.current.setUser(partialUser)
      })

      expect(result.current.user).toEqual(partialUser)
      expect(result.current.user.id).toBe(1)
      expect(result.current.user.name).toBe('Partial User')
      expect(result.current.user.email).toBeUndefined()
      expect(result.current.user.role).toBeUndefined()
    })

    it('should handle empty object', () => {
      const { result } = renderHook(() => useUserStore())
      const emptyUser = {}

      act(() => {
        result.current.setUser(emptyUser)
      })

      expect(result.current.user).toEqual({})
    })
  })

  describe('store reactivity', () => {
    it('should trigger re-renders when user state changes', () => {
      const { result } = renderHook(() => useUserStore())
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'ANALYST'
      }

      expect(result.current.user).toBeNull()

      act(() => {
        result.current.setUser(mockUser)
      })

      // Should have updated the state
      expect(result.current.user).toEqual(mockUser)
    })

    it('should allow multiple hooks to access the same state', () => {
      const { result: result1 } = renderHook(() => useUserStore())
      const { result: result2 } = renderHook(() => useUserStore())
      
      const mockUser = {
        id: 1,
        name: 'Shared User',
        email: 'shared@example.com',
        role: 'ANALYST'
      }

      act(() => {
        result1.current.setUser(mockUser)
      })

      // Both hooks should see the same state
      expect(result1.current.user).toEqual(mockUser)
      expect(result2.current.user).toEqual(mockUser)
    })
  })

  describe('store state persistence', () => {
    it('should maintain state across hook unmount/mount cycles', () => {
      const mockUser = {
        id: 1,
        name: 'Persistent User',
        email: 'persistent@example.com',
        role: 'ANALYST'
      }

      // First hook instance
      const { result: result1, unmount } = renderHook(() => useUserStore())
      
      act(() => {
        result1.current.setUser(mockUser)
      })
      
      expect(result1.current.user).toEqual(mockUser)
      
      // Unmount the first hook
      unmount()
      
      // Create a new hook instance
      const { result: result2 } = renderHook(() => useUserStore())
      
      // State should persist
      expect(result2.current.user).toEqual(mockUser)
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle rapid successive updates', () => {
      const { result } = renderHook(() => useUserStore())
      
      const users = [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' },
        { id: 3, name: 'User 3' }
      ]

      act(() => {
        users.forEach(user => {
          result.current.setUser(user)
        })
      })

      // Should have the last user set
      expect(result.current.user).toEqual(users[2])
    })

    it('should handle complex nested user objects', () => {
      const { result } = renderHook(() => useUserStore())
      const complexUser = {
        id: 1,
        name: 'Complex User',
        profile: {
          avatar: 'avatar.png',
          preferences: {
            theme: 'dark',
            notifications: true
          }
        },
        roles: ['ANALYST', 'VIEWER'],
        metadata: {
          lastLogin: new Date('2023-01-01'),
          permissions: {
            read: true,
            write: true,
            admin: false
          }
        }
      }

      act(() => {
        result.current.setUser(complexUser)
      })

      expect(result.current.user).toEqual(complexUser)
      expect(result.current.user.profile.preferences.theme).toBe('dark')
      expect(result.current.user.roles).toContain('ANALYST')
      expect(result.current.user.metadata.permissions.admin).toBe(false)
    })
  })
})