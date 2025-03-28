import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import SupplierBalance from '../SupplierBalance'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useCurrentOrgBalance } from '@/hooks/useOrganization'
import { wrapper } from '@/tests/utils/wrapper'

// Mock hooks
vi.mock('@/hooks/useOrganization')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => (key === 'balance' ? 'Balance' : key)
  })
}))

describe('SupplierBalance', () => {
  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn()
  }

  beforeEach(() => {
    // Set up default mock data
    useCurrentOrgBalance.mockReturnValue({
      data: {
        totalBalance: 100,
        reservedBalance: -20
      }
    })

    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorageMock
    })

    // Default to showing balance
    sessionStorageMock.getItem.mockReturnValue('1')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders with visible balance by default', () => {
    render(<SupplierBalance />, { wrapper })

    expect(screen.getByText(/Balance:/)).toBeInTheDocument()
    expect(screen.getByText(/100 \(20\)/)).toBeInTheDocument()
    expect(screen.getByText('visibility')).toBeInTheDocument()
  })

  it('hides balance when visibility is toggled off', () => {
    render(<SupplierBalance />, { wrapper })

    // Initially visible
    expect(screen.getByText(/100 \(20\)/)).toBeInTheDocument()

    // Click to hide
    fireEvent.click(screen.getByText('visibility'))

    // Should now be hidden
    expect(screen.queryByText(/100 \(20\)/)).not.toBeInTheDocument()

    // Use a more robust way to find the hidden text - checking for visibility icon
    expect(screen.getByText('visibility_off')).toBeInTheDocument()

    // Check that the balance is now shown as asterisks (text content may be broken up in DOM)
    const balanceSpan =
      screen.getByText(/Balance:/).nextSibling ||
      screen.getByText(/Balance:/).parentElement
    expect(balanceSpan.textContent).toContain('****')

    // Verify sessionStorage was updated
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith('showBalance', '0')
  })

  it('handles missing balance data gracefully', () => {
    useCurrentOrgBalance.mockReturnValue({
      data: null
    })

    render(<SupplierBalance />, { wrapper })

    expect(screen.getByText(/Balance:/)).toBeInTheDocument()
    expect(screen.getByText(/N\/A \(N\/A\)/)).toBeInTheDocument()
  })

  it('formats balance values correctly', () => {
    useCurrentOrgBalance.mockReturnValue({
      data: {
        totalBalance: 1234567.89,
        reservedBalance: -9876.54
      }
    })

    render(<SupplierBalance />, { wrapper })

    // Exact display depends on numberFormatter implementation
    // This test assumes it formats with commas for thousands
    expect(screen.getByText(/1,234,567.89 \(9,876.54\)/)).toBeInTheDocument()
  })
})
