import { wrapper } from '@/utils/test/wrapper'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditOrganization } from './EditOrganization'

// Mock Keycloak
vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: { authenticated: true, token: 'mock-token' },
    initialized: true
  })
}))

describe('EditOrganization Component Tests', () => {
  beforeEach(() => {
    render(<EditOrganization />, { wrapper })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the EditOrganization component correctly', () => {
    expect(screen.getByText(/Edit Organization/i)).toBeInTheDocument()
  })
})
