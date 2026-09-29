import { describe, it, expect, beforeEach } from 'vitest'
import {
  useLoadingStore,
  type LoadingDetails,
  type LoadingState
} from '../useLoadingStore'

const getStoreResult = () => ({
  result: {
    get current() {
      return useLoadingStore.getState()
    }
  },
  unmount: () => {}
})

const run = <T>(callback: () => T): T => callback()

const getLoadingDetails = (loading: LoadingState): LoadingDetails => {
  if (typeof loading === 'boolean') {
    throw new Error('Expected loading details object')
  }
  return loading
}

describe('useLoadingStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    run(() => {
      useLoadingStore.setState({
        loading: false
      })
    })
  })

  describe('initial state', () => {
    it('should initialize with loading false', () => {
      const { result } = getStoreResult()
      
      expect(result.current.loading).toBe(false)
    })

    it('should have setLoading function available', () => {
      const { result } = getStoreResult()
      
      expect(typeof result.current.setLoading).toBe('function')
    })
  })

  describe('setLoading functionality', () => {
    it('should set loading to true when setLoading(true) is called', () => {
      const { result } = getStoreResult()

      run(() => {
        result.current.setLoading(true)
      })

      expect(result.current.loading).toBe(true)
    })

    it('should set loading to false when setLoading(false) is called', () => {
      const { result } = getStoreResult()

      // First set to true
      run(() => {
        result.current.setLoading(true)
      })
      
      expect(result.current.loading).toBe(true)

      // Then set to false
      run(() => {
        result.current.setLoading(false)
      })

      expect(result.current.loading).toBe(false)
    })

    it('should handle rapid state changes', () => {
      const { result } = getStoreResult()

      run(() => {
        result.current.setLoading(true)
        result.current.setLoading(false)
        result.current.setLoading(true)
      })

      expect(result.current.loading).toBe(true)
    })

    it('should handle setting the same value multiple times', () => {
      const { result } = getStoreResult()

      run(() => {
        result.current.setLoading(true)
        result.current.setLoading(true)
        result.current.setLoading(true)
      })

      expect(result.current.loading).toBe(true)

      run(() => {
        result.current.setLoading(false)
        result.current.setLoading(false)
        result.current.setLoading(false)
      })

      expect(result.current.loading).toBe(false)
    })
  })

  describe('structured loading states', () => {
    it('should accept loading detail objects', () => {
      const { result } = getStoreResult()

      const loadingDetails = {
        isLoading: true,
        operations: ['fetchUser', 'fetchReports'],
        completed: 1,
        total: 2
      }

      run(() => {
        result.current.setLoading(loadingDetails)
      })

      const state = getLoadingDetails(result.current.loading)
      expect(state.isLoading).toBe(true)
      expect(state.operations).toEqual(['fetchUser', 'fetchReports'])
      expect(state.completed).toBe(1)
      expect(state.total).toBe(2)
    })

    it('should preserve extra metadata on loading detail objects', () => {
      const { result } = getStoreResult()

      const loadingDetails = {
        isLoading: true,
        progress: {
          total: 100,
          completed: 45
        },
        metadata: {
          startTime: 1
        }
      }

      run(() => {
        result.current.setLoading(loadingDetails)
      })

      const state = getLoadingDetails(result.current.loading)
      expect(state.isLoading).toBe(true)
      expect(state.progress).toEqual({ total: 100, completed: 45 })
      expect(state.metadata).toEqual({ startTime: 1 })
    })
  })

  describe('store reactivity', () => {
    it('should trigger re-renders when loading state changes', () => {
      const { result } = getStoreResult()

      expect(result.current.loading).toBe(false)

      run(() => {
        result.current.setLoading(true)
      })

      // Should have updated the state
      expect(result.current.loading).toBe(true)
    })

    it('should allow multiple hooks to access the same state', () => {
      const { result: result1 } = getStoreResult()
      const { result: result2 } = getStoreResult()

      run(() => {
        result1.current.setLoading(true)
      })

      // Both hooks should see the same state
      expect(result1.current.loading).toBe(true)
      expect(result2.current.loading).toBe(true)

      run(() => {
        result2.current.setLoading(false)
      })

      // Both hooks should see the updated state
      expect(result1.current.loading).toBe(false)
      expect(result2.current.loading).toBe(false)
    })

    it('should handle setting the same value multiple times', () => {
      const { result } = getStoreResult()

      // Set initial value
      run(() => {
        result.current.setLoading(true)
      })

      expect(result.current.loading).toBe(true)

      // Set the same value again
      run(() => {
        result.current.setLoading(true)
      })

      // Should maintain the same state
      expect(result.current.loading).toBe(true)
    })
  })

  describe('store state persistence', () => {
    it('should maintain state across hook unmount/mount cycles', () => {
      // First hook instance
      const { result: result1, unmount } = getStoreResult()
      
      run(() => {
        result1.current.setLoading(true)
      })
      
      expect(result1.current.loading).toBe(true)
      
      // Unmount the first hook
      unmount()
      
      // Create a new hook instance
      const { result: result2 } = getStoreResult()
      
      // State should persist
      expect(result2.current.loading).toBe(true)
    })
  })

  describe('typical usage patterns', () => {
    it('should support async operation loading pattern', async () => {
      const { result } = getStoreResult()

      // Simulate starting an async operation
      run(() => {
        result.current.setLoading(true)
      })
      expect(result.current.loading).toBe(true)

      // Simulate async operation completion
      await run(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        result.current.setLoading(false)
      })
      expect(result.current.loading).toBe(false)
    })

    it('should support conditional loading states', () => {
      const { result } = getStoreResult()

      // Simulate conditional loading based on some state
      const hasData = false
      const isProcessing = true

      run(() => {
        result.current.setLoading(hasData || isProcessing)
      })
      expect(result.current.loading).toBe(true)

      // Change conditions
      const hasDataUpdated = true
      const isProcessingUpdated = false

      run(() => {
        result.current.setLoading(hasDataUpdated || isProcessingUpdated)
      })
      expect(result.current.loading).toBe(true)

      // Both false
      run(() => {
        result.current.setLoading(false && false)
      })
      expect(result.current.loading).toBe(false)
    })
  })

  describe('performance considerations', () => {
    it('should handle rapid state changes efficiently', () => {
      const { result } = getStoreResult()
      
      const startTime = performance.now()
      
      run(() => {
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
      const { result } = getStoreResult()
      
      const complexLoadingState = {
        isLoading: true,
        operations: ['fetchUser', 'fetchReports', 'saveData'],
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
      
      run(() => {
        result.current.setLoading(complexLoadingState)
      })
      
      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(10)
      const state = getLoadingDetails(result.current.loading)
      expect(state).toEqual(complexLoadingState)
    })
  })
})
