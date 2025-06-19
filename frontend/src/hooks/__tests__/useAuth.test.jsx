import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

  it('should return context when used within AuthProvider', () => {
    const mockContextValue = {
      keycloak: {
        authenticated: true,
        token: 'mock-token',
        login: vi.fn(),
        logout: vi.fn()
      }
    }

    const wrapper = ({ children }) => (
      <KeycloakContext.Provider value={mockContextValue}>
        {children}
      </KeycloakContext.Provider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current).toEqual(mockContextValue)
  })

  it('should throw error when used outside AuthProvider', () => {
    // Suppress console.error for this test
    const originalError = console.error
    console.error = vi.fn()

    expect(() => {
      renderHook(() => useAuth())
    }).toThrow('useKeycloak must be used within an AuthProvider')

    console.error = originalError
  })

  it('should throw error when context is null', () => {
    const originalError = console.error
    console.error = vi.fn()

    const wrapper = ({ children }) => (
      <KeycloakContext.Provider value={null}>
        {children}
      </KeycloakContext.Provider>
    )

    expect(() => {
      renderHook(() => useAuth(), { wrapper })
    }).toThrow('useKeycloak must be used within an AuthProvider')

    console.error = originalError
  })

  it('should throw error when context is undefined', () => {
    const originalError = console.error
    console.error = vi.fn()

    const wrapper = ({ children }) => (
      <KeycloakContext.Provider value={undefined}>
        {children}
      </KeycloakContext.Provider>
    )

    expect(() => {
      renderHook(() => useAuth(), { wrapper })
    }).toThrow('useKeycloak must be used within an AuthProvider')

    console.error = originalError
  })
})
