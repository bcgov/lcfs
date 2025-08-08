import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useLoadingStore } from '../useLoadingStore'

describe('useLoadingStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useLoadingStore.setState({ loading: false })
    })
  })

  describe('initial state', () => {
    it('should initialize with loading false', () => {
      const { result } = renderHook(() => useLoadingStore())
      
      expect(result.current.loading).toBe(false)
    })

    it('should have setLoading function available', () => {
      const { result } = renderHook(() => useLoadingStore())
      
      expect(typeof result.current.setLoading).toBe('function')
    })
  })

  describe('setLoading functionality', () => {
    it('should set loading to true when setLoading(true) is called', () => {
      const { result } = renderHook(() => useLoadingStore())

      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.loading).toBe(true)
    })

    it('should set loading to false when setLoading(false) is called', () => {
      const { result } = renderHook(() => useLoadingStore())

      // First set to true
      act(() => {
        result.current.setLoading(true)
      })
      
      expect(result.current.loading).toBe(true)

      // Then set to false
      act(() => {
        result.current.setLoading(false)
      })

      expect(result.current.loading).toBe(false)
    })

    it('should handle rapid state changes', () => {
      const { result } = renderHook(() => useLoadingStore())

      act(() => {
        result.current.setLoading(true)
        result.current.setLoading(false)
        result.current.setLoading(true)
      })

      expect(result.current.loading).toBe(true)
    })

    it('should handle setting the same value multiple times', () => {
      const { result } = renderHook(() => useLoadingStore())

      act(() => {
        result.current.setLoading(true)
        result.current.setLoading(true)
        result.current.setLoading(true)
      })

      expect(result.current.loading).toBe(true)

      act(() => {
        result.current.setLoading(false)
        result.current.setLoading(false)
        result.current.setLoading(false)
      })

      expect(result.current.loading).toBe(false)
    })
  })

  describe('edge cases and type handling', () => {
    it('should handle truthy values as true', () => {
      const { result } = renderHook(() => useLoadingStore())
      
      const truthyValues = [1, 'loading', {}, [], 'true']

      truthyValues.forEach(value => {
        act(() => {
          result.current.setLoading(value)
        })
        expect(result.current.loading).toBe(value)
      })
    })

    it('should handle falsy values as provided', () => {
      const { result } = renderHook(() => useLoadingStore())
      
      const falsyValues = [0, '', null, undefined, false]

      falsyValues.forEach(value => {
        act(() => {
          result.current.setLoading(value)
        })
        expect(result.current.loading).toBe(value)
      })
    })

    it('should handle non-boolean values', () => {
      const { result } = renderHook(() => useLoadingStore())

      // String
      act(() => {
        result.current.setLoading('loading')
      })
      expect(result.current.loading).toBe('loading')

      // Number
      act(() => {
        result.current.setLoading(1)
      })
      expect(result.current.loading).toBe(1)

      // Object
      const loadingObj = { status: 'loading', progress: 50 }
      act(() => {
        result.current.setLoading(loadingObj)
      })
      expect(result.current.loading).toEqual(loadingObj)

      // Array
      const loadingArray = ['step1', 'step2']
      act(() => {
        result.current.setLoading(loadingArray)
      })
      expect(result.current.loading).toEqual(loadingArray)
    })
  })

  describe('store reactivity', () => {
    it('should trigger re-renders when loading state changes', () => {
      const { result } = renderHook(() => useLoadingStore())

      expect(result.current.loading).toBe(false)

      act(() => {
        result.current.setLoading(true)
      })

      // Should have updated the state
      expect(result.current.loading).toBe(true)
    })

    it('should allow multiple hooks to access the same state', () => {
      const { result: result1 } = renderHook(() => useLoadingStore())
      const { result: result2 } = renderHook(() => useLoadingStore())

      act(() => {
        result1.current.setLoading(true)
      })

      // Both hooks should see the same state
      expect(result1.current.loading).toBe(true)
      expect(result2.current.loading).toBe(true)

      act(() => {
        result2.current.setLoading(false)
      })

      // Both hooks should see the updated state
      expect(result1.current.loading).toBe(false)
      expect(result2.current.loading).toBe(false)
    })

    it('should handle setting the same value multiple times', () => {
      const { result } = renderHook(() => useLoadingStore())

      // Set initial value
      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.loading).toBe(true)

      // Set the same value again
      act(() => {
        result.current.setLoading(true)
      })

      // Should maintain the same state
      expect(result.current.loading).toBe(true)
    })
  })

  describe('store state persistence', () => {
    it('should maintain state across hook unmount/mount cycles', () => {
      // First hook instance
      const { result: result1, unmount } = renderHook(() => useLoadingStore())
      
      act(() => {
        result1.current.setLoading(true)
      })
      
      expect(result1.current.loading).toBe(true)
      
      // Unmount the first hook
      unmount()
      
      // Create a new hook instance
      const { result: result2 } = renderHook(() => useLoadingStore())
      
      // State should persist
      expect(result2.current.loading).toBe(true)
    })
  })

  describe('typical usage patterns', () => {
    it('should support async operation loading pattern', async () => {
      const { result } = renderHook(() => useLoadingStore())

      // Simulate starting an async operation
      act(() => {
        result.current.setLoading(true)
      })
      expect(result.current.loading).toBe(true)

      // Simulate async operation completion
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        result.current.setLoading(false)
      })
      expect(result.current.loading).toBe(false)
    })

    it('should support conditional loading states', () => {
      const { result } = renderHook(() => useLoadingStore())

      // Simulate conditional loading based on some state
      const hasData = false
      const isProcessing = true

      act(() => {
        result.current.setLoading(hasData || isProcessing)
      })
      expect(result.current.loading).toBe(true)

      // Change conditions
      const hasDataUpdated = true
      const isProcessingUpdated = false

      act(() => {
        result.current.setLoading(hasDataUpdated || isProcessingUpdated)
      })
      expect(result.current.loading).toBe(true)

      // Both false
      act(() => {
        result.current.setLoading(false && false)
      })
      expect(result.current.loading).toBe(false)
    })
  })

  describe('performance considerations', () => {
    it('should handle rapid state changes efficiently', () => {
      const { result } = renderHook(() => useLoadingStore())
      
      const startTime = performance.now()
      
      act(() => {
        // Simulate rapid state changes
        for (let i = 0; i < 100; i++) {
          result.current.setLoading(i % 2 === 0)
        }
      })
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete rapidly (less than 50ms)
      expect(duration).toBeLessThan(50)
      expect(result.current.loading).toBe(false) // 100 is even, so final state should be false
    })

    it('should handle complex loading objects efficiently', () => {
      const { result } = renderHook(() => useLoadingStore())
      
      const complexLoadingState = {
        isLoading: true,
        operations: {
          fetchUser: true,
          fetchReports: false,
          saveData: true
        },
        progress: {
          total: 100,
          completed: 45,
          step: 'Processing reports'
        },
        metadata: {
          startTime: Date.now(),
          estimatedCompletion: Date.now() + 30000
        }
      }

      const startTime = performance.now()
      
      act(() => {
        result.current.setLoading(complexLoadingState)
      })
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      expect(duration).toBeLessThan(10)
      expect(result.current.loading).toEqual(complexLoadingState)
    })
  })
})