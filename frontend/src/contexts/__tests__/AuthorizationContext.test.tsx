import { vi, describe, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import {
  AuthorizationProvider,
  useAuthorization
} from '../AuthorizationContext'
import React from 'react'
import { makeProvider, test, type TestRenderHook } from '@/tests/utils/fixtures'

const authorization = makeProvider('custom', (children) => (
  <AuthorizationProvider>{children}</AuthorizationProvider>
))

const renderAuthorization = (renderHook: TestRenderHook) =>
  renderHook(() => useAuthorization(), [authorization])

describe('AuthorizationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    test('should initialize with forbidden as false', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)
      expect(result.current.forbidden).toBe(false)
    })

    test('should initialize with empty errorRefs array', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)
      expect(result.current.errorRefs).toEqual([])
    })

    test('should initialize with errorStatus as null', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)
      expect(result.current.errorStatus).toBe(null)
    })

    test('should initialize with serverErrorBlockedRef as false', ({
      renderHook
    }) => {
      const { result } = renderAuthorization(renderHook)
      expect(result.current.serverErrorBlockedRef.current).toBe(false)
    })
  })

  describe('setForbidden', () => {
    test('should update forbidden state to true', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)

      act(() => {
        result.current.setForbidden(true)
      })

      expect(result.current.forbidden).toBe(true)
    })

    test('should update forbidden state to false', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)

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
    test('should add a reference number to errorRefs', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)

      act(() => {
        result.current.addErrorRef('ref-123')
      })

      expect(result.current.errorRefs).toEqual(['ref-123'])
    })

    test('should add multiple reference numbers', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)

      act(() => {
        result.current.addErrorRef('ref-123')
        result.current.addErrorRef('ref-456')
        result.current.addErrorRef('ref-789')
      })

      expect(result.current.errorRefs).toEqual([
        'ref-123',
        'ref-456',
        'ref-789'
      ])
    })

    test('should not add duplicate reference numbers', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)

      act(() => {
        result.current.addErrorRef('ref-123')
        result.current.addErrorRef('ref-123')
        result.current.addErrorRef('ref-456')
        result.current.addErrorRef('ref-123')
      })

      expect(result.current.errorRefs).toEqual(['ref-123', 'ref-456'])
    })

    test('should not add empty string reference', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)

      act(() => {
        result.current.addErrorRef('')
      })

      expect(result.current.errorRefs).toEqual([])
    })

    test('should not add null or undefined reference', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)

      act(() => {
        result.current.addErrorRef(null as any)
        result.current.addErrorRef(undefined as any)
      })

      expect(result.current.errorRefs).toEqual([])
    })
  })

  describe('clearErrorRefs', () => {
    test('should clear all error references', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)

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

    test('should do nothing when errorRefs is already empty', ({
      renderHook
    }) => {
      const { result } = renderAuthorization(renderHook)

      act(() => {
        result.current.clearErrorRefs()
      })

      expect(result.current.errorRefs).toEqual([])
    })
  })

  describe('setErrorStatus', () => {
    test('should set error status to 500', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)

      act(() => {
        result.current.setErrorStatus(500)
      })

      expect(result.current.errorStatus).toBe(500)
    })

    test('should set serverErrorBlockedRef to true when status is 500', ({
      renderHook
    }) => {
      const { result } = renderAuthorization(renderHook)

      act(() => {
        result.current.setErrorStatus(500)
      })

      expect(result.current.serverErrorBlockedRef.current).toBe(true)
    })

    test('should not set serverErrorBlockedRef to true for non-500 errors', ({
      renderHook
    }) => {
      const { result } = renderAuthorization(renderHook)

      act(() => {
        result.current.setErrorStatus(404)
      })

      expect(result.current.errorStatus).toBe(404)
      expect(result.current.serverErrorBlockedRef.current).toBe(false)
    })

    test('should update error status to null', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)

      act(() => {
        result.current.setErrorStatus(500)
      })
      expect(result.current.errorStatus).toBe(500)

      act(() => {
        result.current.setErrorStatus(null)
      })

      expect(result.current.errorStatus).toBe(null)
    })

    test('should handle multiple error status changes', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)

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
    test('should reset all error-related state', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)

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

    test('should work when called on clean state', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)

      act(() => {
        result.current.resetServerError()
      })

      expect(result.current.errorRefs).toEqual([])
      expect(result.current.errorStatus).toBe(null)
      expect(result.current.serverErrorBlockedRef.current).toBe(false)
    })

    test('should reset serverErrorBlockedRef even if set manually', ({
      renderHook
    }) => {
      const { result } = renderAuthorization(renderHook)

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
    test('should handle complete 500 error flow', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)

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

    test('should handle multiple errors before reset', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)

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

    test('should maintain forbidden state independently from error state', ({
      renderHook
    }) => {
      const { result } = renderAuthorization(renderHook)

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
    test('should throw error when useAuthorization is used outside provider', ({
      renderHook
    }) => {
      expect(() => {
        renderHook(() => useAuthorization(), [])
      }).toThrow(
        'useAuthorization must be used within an AuthorizationProvider'
      )
    })
  })

  describe('Memoization', () => {
    test('should update context value when state changes', ({ renderHook }) => {
      const { result } = renderAuthorization(renderHook)

      const initialValue = result.current

      act(() => {
        result.current.setErrorStatus(500)
      })

      expect(result.current).not.toBe(initialValue)
      expect(result.current.errorStatus).toBe(500)
    })

    test('should preserve function references across re-renders', ({
      renderHook
    }) => {
      const { result, rerender } = renderAuthorization(renderHook)

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
    test('should provide default values when context is missing properties', ({
      renderHook
    }) => {
      const { result } = renderAuthorization(renderHook)

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
