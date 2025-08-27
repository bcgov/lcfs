import React from 'react'
import { render, screen } from '@testing-library/react'
import { TransferDetailsCard } from '../TransferDetailsCard'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Only mock absolutely necessary external dependencies
vi.mock('@/utils/formatters', () => ({
  calculateTotalValue: vi.fn().mockReturnValue(2550),
  currencyFormatter: vi.fn().mockReturnValue('$2,550.00'),
  formatNumberWithCommas: vi.fn().mockReturnValue('100')
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ 
    t: (key) => key 
  })
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => <div data-test="typography" {...props}>{children}</div>
}))

vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }) => <div data-test="bcbox" {...props}>{children}</div>
}))

vi.mock('@/views/Transfers/components', () => ({
  OrganizationBadge: (props) => <div data-test="organization-badge" data-org-id={props.organizationId} data-org-name={props.organizationName}>{props.organizationName}</div>
}))

import { calculateTotalValue, currencyFormatter, formatNumberWithCommas } from '@/utils/formatters'

describe('TransferDetailsCard Component', () => {
  const defaultProps = {
    fromOrgId: 1,
    fromOrganization: 'Organization A',
    toOrgId: 2,
    toOrganization: 'Organization B',
    quantity: 100,
    pricePerUnit: 25.50,
    transferStatus: 'Submitted',
    isGovernmentUser: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock return values
    vi.mocked(calculateTotalValue).mockReturnValue(2550)
    vi.mocked(currencyFormatter).mockReturnValue('$2,550.00')
    vi.mocked(formatNumberWithCommas).mockReturnValue('100')
  })

  describe('Basic Rendering', () => {
    it('renders component without crashing', () => {
      expect(() => render(<TransferDetailsCard {...defaultProps} />)).not.toThrow()
    })
  })

  describe('Hook Integration', () => {
    it('renders component and calls utility functions', () => {
      render(<TransferDetailsCard {...defaultProps} />)
      expect(vi.mocked(calculateTotalValue)).toHaveBeenCalledWith(100, 25.50)
      expect(vi.mocked(currencyFormatter)).toHaveBeenCalledWith({ value: 2550 })
      expect(vi.mocked(formatNumberWithCommas)).toHaveBeenCalledWith({ value: 100 })
    })
  })

  describe('Content Rendering', () => {
    it('displays organization names', () => {
      render(<TransferDetailsCard {...defaultProps} />)
      expect(screen.getByText('Organization A')).toBeInTheDocument()
      expect(screen.getByText('Organization B')).toBeInTheDocument()
    })

    it('displays formatted values', () => {
      render(<TransferDetailsCard {...defaultProps} />)
      expect(screen.getByText('100 transfer:complianceUnits')).toBeInTheDocument()
      expect(screen.getByText('$2,550.00')).toBeInTheDocument()
    })
  })

  describe('Props Integration', () => {
    it('handles minimal props without crashing', () => {
      const minimalProps = {
        quantity: 50,
        pricePerUnit: 10
      }
      
      expect(() => render(<TransferDetailsCard {...minimalProps} />)).not.toThrow()
    })

    it('handles zero values', () => {
      const zeroProps = {
        ...defaultProps,
        quantity: 0,
        pricePerUnit: 0
      }
      
      vi.mocked(calculateTotalValue).mockReturnValue(0)
      vi.mocked(currencyFormatter).mockReturnValue('$0.00')
      vi.mocked(formatNumberWithCommas).mockReturnValue('0')
      
      render(<TransferDetailsCard {...zeroProps} />)
      
      expect(vi.mocked(calculateTotalValue)).toHaveBeenCalledWith(0, 0)
      expect(vi.mocked(currencyFormatter)).toHaveBeenCalledWith({ value: 0 })
      expect(vi.mocked(formatNumberWithCommas)).toHaveBeenCalledWith({ value: 0 })
    })

    it('handles large numbers', () => {
      const largeProps = {
        ...defaultProps,
        quantity: 1000000,
        pricePerUnit: 999.99
      }
      
      vi.mocked(calculateTotalValue).mockReturnValue(999990000)
      
      render(<TransferDetailsCard {...largeProps} />)
      
      expect(vi.mocked(calculateTotalValue)).toHaveBeenCalledWith(1000000, 999.99)
    })

    it('passes correct props to OrganizationBadge components', () => {
      render(<TransferDetailsCard {...defaultProps} />)
      
      const orgBadges = screen.getAllByTestId('organization-badge')
      expect(orgBadges).toHaveLength(2)
      expect(orgBadges[0]).toHaveAttribute('data-org-id', '1')
      expect(orgBadges[0]).toHaveAttribute('data-org-name', 'Organization A')
      expect(orgBadges[1]).toHaveAttribute('data-org-id', '2')
      expect(orgBadges[1]).toHaveAttribute('data-org-name', 'Organization B')
    })
  })
})