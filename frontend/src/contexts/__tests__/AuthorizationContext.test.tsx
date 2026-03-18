import { vi, describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthorizationProvider, useAuthorization } from '../AuthorizationContext'
import React from 'react'

describe('AuthorizationContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthorizationProvider>{children}</AuthorizationProvider>
  )

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should initialize with forbidden as false', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })
      expect(result.current.forbidden).toBe(false)
    })

    it('should initialize with empty errorRefs array', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })
      expect(result.current.errorRefs).toEqual([])
    })

    it('should initialize with errorStatus as null', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })
      expect(result.current.errorStatus).toBe(null)
    })

    it('should initialize with serverErrorBlockedRef as false', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })
      expect(result.current.serverErrorBlockedRef.current).toBe(false)
    })
  })

  describe('setForbidden', () => {
    it('should update forbidden state to true', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.setForbidden(true)
      })

      expect(result.current.forbidden).toBe(true)
    })

    it('should update forbidden state to false', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.setForbidden(true)
      })
      expect(result.current.forbidden).toBe(true)

      act(() => {
        result.current.setForbidden(false)
      })
      expect(result.current.forbidden).toBe(false)
    })
  })

  describe('addErrorRef', () => {
    it('should add a reference number to errorRefs', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.addErrorRef('ref-123')
      })

      expect(result.current.errorRefs).toEqual(['ref-123'])
    })

    it('should add multiple reference numbers', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.addErrorRef('ref-123')
        result.current.addErrorRef('ref-456')
        result.current.addErrorRef('ref-789')
      })

      expect(result.current.errorRefs).toEqual(['ref-123', 'ref-456', 'ref-789'])
    })

    it('should not add duplicate reference numbers', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.addErrorRef('ref-123')
        result.current.addErrorRef('ref-123')
        result.current.addErrorRef('ref-456')
        result.current.addErrorRef('ref-123')
      })

      expect(result.current.errorRefs).toEqual(['ref-123', 'ref-456'])
    })

    it('should not add empty string reference', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.addErrorRef('')
      })

      expect(result.current.errorRefs).toEqual([])
    })

    it('should not add null or undefined reference', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.addErrorRef(null as any)
        result.current.addErrorRef(undefined as any)
      })

      expect(result.current.errorRefs).toEqual([])
    })
  })

  describe('clearErrorRefs', () => {
    it('should clear all error references', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.addErrorRef('ref-123')
        result.current.addErrorRef('ref-456')
      })
      expect(result.current.errorRefs).toEqual(['ref-123', 'ref-456'])

      act(() => {
        result.current.clearErrorRefs()
      })

      expect(result.current.errorRefs).toEqual([])
    })

    it('should do nothing when errorRefs is already empty', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.clearErrorRefs()
      })

      expect(result.current.errorRefs).toEqual([])
    })
  })

  describe('setErrorStatus', () => {
    it('should set error status to 500', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.setErrorStatus(500)
      })

      expect(result.current.errorStatus).toBe(500)
    })

    it('should set serverErrorBlockedRef to true when status is 500', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.setErrorStatus(500)
      })

      expect(result.current.serverErrorBlockedRef.current).toBe(true)
    })

    it('should not set serverErrorBlockedRef to true for non-500 errors', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.setErrorStatus(404)
      })

      expect(result.current.errorStatus).toBe(404)
      expect(result.current.serverErrorBlockedRef.current).toBe(false)
    })

    it('should update error status to null', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.setErrorStatus(500)
      })
      expect(result.current.errorStatus).toBe(500)

      act(() => {
        result.current.setErrorStatus(null)
      })

      expect(result.current.errorStatus).toBe(null)
    })

    it('should handle multiple error status changes', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.setErrorStatus(404)
      })
      expect(result.current.errorStatus).toBe(404)

      act(() => {
        result.current.setErrorStatus(500)
      })
      expect(result.current.errorStatus).toBe(500)
      expect(result.current.serverErrorBlockedRef.current).toBe(true)

      act(() => {
        result.current.setErrorStatus(403)
      })
      expect(result.current.errorStatus).toBe(403)
    })
  })

  describe('resetServerError', () => {
    it('should reset all error-related state', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.addErrorRef('ref-123')
        result.current.addErrorRef('ref-456')
        result.current.setErrorStatus(500)
      })

      expect(result.current.errorRefs).toEqual(['ref-123', 'ref-456'])
      expect(result.current.errorStatus).toBe(500)
      expect(result.current.serverErrorBlockedRef.current).toBe(true)

      act(() => {
        result.current.resetServerError()
      })

      expect(result.current.errorRefs).toEqual([])
      expect(result.current.errorStatus).toBe(null)
      expect(result.current.serverErrorBlockedRef.current).toBe(false)
    })

    it('should work when called on clean state', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.resetServerError()
      })

      expect(result.current.errorRefs).toEqual([])
      expect(result.current.errorStatus).toBe(null)
      expect(result.current.serverErrorBlockedRef.current).toBe(false)
    })

    it('should reset serverErrorBlockedRef even if set manually', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.serverErrorBlockedRef.current = true
        result.current.addErrorRef('ref-999')
        result.current.setErrorStatus(503)
      })

      expect(result.current.serverErrorBlockedRef.current).toBe(true)

      act(() => {
        result.current.resetServerError()
      })

      expect(result.current.serverErrorBlockedRef.current).toBe(false)
      expect(result.current.errorRefs).toEqual([])
      expect(result.current.errorStatus).toBe(null)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complete 500 error flow', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.addErrorRef('correlation-id-abc')
        result.current.setErrorStatus(500)
      })

      expect(result.current.errorStatus).toBe(500)
      expect(result.current.errorRefs).toEqual(['correlation-id-abc'])
      expect(result.current.serverErrorBlockedRef.current).toBe(true)

      act(() => {
        result.current.resetServerError()
      })

      expect(result.current.errorStatus).toBe(null)
      expect(result.current.errorRefs).toEqual([])
      expect(result.current.serverErrorBlockedRef.current).toBe(false)
    })

    it('should handle multiple errors before reset', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.addErrorRef('ref-1')
        result.current.setErrorStatus(500)
        result.current.addErrorRef('ref-2')
        result.current.addErrorRef('ref-3')
      })

      expect(result.current.errorRefs).toEqual(['ref-1', 'ref-2', 'ref-3'])
      expect(result.current.errorStatus).toBe(500)

      act(() => {
        result.current.clearErrorRefs()
        result.current.setErrorStatus(null)
      })

      expect(result.current.errorRefs).toEqual([])
      expect(result.current.errorStatus).toBe(null)
    })

    it('should maintain forbidden state independently from error state', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      act(() => {
        result.current.setForbidden(true)
        result.current.setErrorStatus(500)
        result.current.addErrorRef('ref-abc')
      })

      expect(result.current.forbidden).toBe(true)
      expect(result.current.errorStatus).toBe(500)

      act(() => {
        result.current.resetServerError()
      })

      expect(result.current.forbidden).toBe(true)
      expect(result.current.errorStatus).toBe(null)
    })
  })

  describe('Error Handling', () => {
    it('should throw error when useAuthorization is used outside provider', () => {
      expect(() => {
        renderHook(() => useAuthorization())
      }).toThrow('useAuthorization must be used within an AuthorizationProvider')
    })
  })

  describe('Memoization', () => {
    it('should update context value when state changes', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      const initialValue = result.current

      act(() => {
        result.current.setErrorStatus(500)
      })

      expect(result.current).not.toBe(initialValue)
      expect(result.current.errorStatus).toBe(500)
    })

    it('should preserve function references across re-renders', () => {
      const { result, rerender } = renderHook(() => useAuthorization(), { wrapper })

      const initialSetForbidden = result.current.setForbidden
      const initialAddErrorRef = result.current.addErrorRef
      const initialClearErrorRefs = result.current.clearErrorRefs
      const initialResetServerError = result.current.resetServerError
      const initialSetErrorStatus = result.current.setErrorStatus

      rerender()

      expect(result.current.setForbidden).toBe(initialSetForbidden)
      expect(result.current.addErrorRef).toBe(initialAddErrorRef)
      expect(result.current.clearErrorRefs).toBe(initialClearErrorRefs)
      expect(result.current.resetServerError).toBe(initialResetServerError)
      expect(result.current.setErrorStatus).toBe(initialSetErrorStatus)
    })
  })

  describe('Default Values', () => {
    it('should provide default values when context is missing properties', () => {
      const { result } = renderHook(() => useAuthorization(), { wrapper })

      expect(result.current.forbidden).toBeDefined()
      expect(result.current.setForbidden).toBeDefined()
      expect(result.current.errorRefs).toBeDefined()
      expect(result.current.addErrorRef).toBeDefined()
      expect(result.current.clearErrorRefs).toBeDefined()
      expect(result.current.resetServerError).toBeDefined()
      expect(result.current.errorStatus).toBeDefined()
      expect(result.current.setErrorStatus).toBeDefined()
      expect(result.current.serverErrorBlockedRef).toBeDefined()
    })
  })
})
