import React from 'react'
import { render, screen } from '@testing-library/react'
import { HeaderComponent } from '../HeaderComponent'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { wrapper } from '@/tests/utils/wrapper'
import { ROUTES } from '@/routes/routes'

// Mock all required hooks and components
vi.mock('@/hooks/useCurrentUser')
vi.mock('../SupplierBalance', () => ({
  __esModule: true,
  default: () => <div data-testid="supplier-balance">Supplier Balance</div>
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => (key === 'govOrg' ? 'Government of BC' : key)
  })
}))

describe('HeaderComponent', () => {
  beforeEach(() => {
    // Default mock setup for non-government user with organization
    useCurrentUser.mockReturnValue({
      data: {
        isGovernmentUser: false,
        organization: {
          name: 'Test Organization',
          organizationId: '123'
        }
      },
      isFetched: true
    })
  })

  it('renders organization name for non-government user', () => {
    render(<HeaderComponent />, { wrapper })

    const orgNameLink = screen.getByText('Test Organization')
    expect(orgNameLink).toBeInTheDocument()
    expect(orgNameLink.tagName).toBe('A')
    expect(orgNameLink).toHaveAttribute('href', ROUTES.ORGANIZATION.ORG)

    const supplierBalance = screen.getByText('Supplier Balance')
    expect(supplierBalance).toBeInTheDocument()
  })

  it('renders government organization name for government user', () => {
    useCurrentUser.mockReturnValue({
      data: {
        isGovernmentUser: true,
        organization: null
      },
      isFetched: true
    })

    render(<HeaderComponent />, { wrapper })

    const orgName = screen.getByText('Government of BC')
    expect(orgName).toBeInTheDocument()
    expect(screen.queryByText('Supplier Balance')).not.toBeInTheDocument()
  })

  it('does not render supplier balance for users without an organization ID', () => {
    useCurrentUser.mockReturnValue({
      data: {
        isGovernmentUser: false,
        organization: {
          name: 'Test Organization Without ID'
        }
      },
      isFetched: true
    })

    render(<HeaderComponent />, { wrapper })

    expect(screen.getByText('Test Organization Without ID')).toBeInTheDocument()
    expect(screen.queryByText('Supplier Balance')).not.toBeInTheDocument()
  })

  it('does not render when data is not fetched', () => {
    useCurrentUser.mockReturnValue({
      isFetched: false
    })

    const { container } = render(<HeaderComponent />, { wrapper })

    expect(container).toBeEmptyDOMElement()
  })
})
