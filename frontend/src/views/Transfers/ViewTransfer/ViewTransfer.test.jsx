import { wrapper } from '@/utils/test/wrapper'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ViewTransfer } from './ViewTransfer'

// Mock Keycloak
vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: { authenticated: true, token: 'mock-token' },
    initialized: true
  })
}))

describe('ViewTransfer Component Tests', () => {
  beforeEach(() => {
    render(<ViewTransfer />, { wrapper })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders Loading', () => {
    expect(screen.getByText(/Loading/i)).toBeInTheDocument()
  })
})
