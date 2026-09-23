import { describe, expect, vi, beforeEach, afterEach } from 'vitest'
import { makeProvider, test } from '@/tests/utils/fixtures'
import { useAuth } from '../useAuth'
import { KeycloakContext } from '@/components/KeycloakProvider'
import React from 'react'

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('should return context when used within AuthProvider', ({
    renderHook
  }) => {
    const mockContextValue = {
      keycloak: {
        authenticated: true,
        token: 'mock-token',
        login: vi.fn(),
        logout: vi.fn()
      }
    }

    const provider = makeProvider('custom', (children) => (
      <KeycloakContext.Provider value={mockContextValue}>
        {children}
      </KeycloakContext.Provider>
    ))

    const { result } = renderHook(() => useAuth(), [provider])

    expect(result.current).toEqual(mockContextValue)
  })

  test('should throw error when used outside AuthProvider', ({
    renderHook
  }) => {
    // Suppress console.error for this test
    const originalError = console.error
    console.error = vi.fn()

    expect(() => {
      renderHook(() => useAuth(), [])
    }).toThrow('useKeycloak must be used within an AuthProvider')

    console.error = originalError
  })

  test('should throw error when context is null', ({ renderHook }) => {
    const originalError = console.error
    console.error = vi.fn()

    const provider = makeProvider('custom', (children) => (
      <KeycloakContext.Provider value={null}>
        {children}
      </KeycloakContext.Provider>
    ))

    expect(() => {
      renderHook(() => useAuth(), [provider])
    }).toThrow('useKeycloak must be used within an AuthProvider')

    console.error = originalError
  })

  test('should throw error when context is undefined', ({ renderHook }) => {
    const originalError = console.error
    console.error = vi.fn()

    const provider = makeProvider('custom', (children) => (
      <KeycloakContext.Provider value={undefined}>
        {children}
      </KeycloakContext.Provider>
    ))

    expect(() => {
      renderHook(() => useAuth(), [provider])
    }).toThrow('useKeycloak must be used within an AuthProvider')

    console.error = originalError
  })
})
