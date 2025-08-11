import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { wrapper } from '@/tests/utils/wrapper.jsx'
import { OrganizationProfile } from '../OrganizationProfile.jsx'
import * as formatters from '@/utils/formatters.js'
import * as addressUtils from '@/utils/constructAddress.js'

// Mocks
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }) => (
    <div data-test="bc-box" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, variant, ...props }) => (
    <div data-test="bc-typography" data-variant={variant} {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/Loading', () => ({
  default: () => <div data-test="loading">Loading...</div>
}))

vi.mock('@/components/Role', () => ({
  Role: ({ children, roles }) => (
    <div data-test="role" data-roles={JSON.stringify(roles)}>
      {children}
    </div>
  )
}))

vi.mock('@/constants/roles', () => ({
  roles: {
    government: 'government',
    supplier: 'supplier'
  }
}))

vi.mock('@/constants/statuses', () => ({
  ORGANIZATION_STATUSES: {
    REGISTERED: 'registered',
    UNREGISTERED: 'unregistered'
  }
}))

vi.mock('@/constants/common', () => ({
  CURRENT_COMPLIANCE_YEAR: 2024
}))

vi.mock('@/utils/formatters')
vi.mock('@/utils/constructAddress')

const mockOrgData = {
  name: 'Test Organization',
  operatingName: 'Test Org',
  phone: '6041234567',
  email: 'test@example.com',
  recordsAddress: '789 Records St, Vancouver, BC',
  hasEarlyIssuance: true,
  creditTradingEnabled: true,
  orgStatus: {
    status: 'registered'
  },
  orgAddress: {
    streetAddress: '123 Main St',
    city: 'Vancouver',
    provinceState: 'BC',
    postalcodeZipcode: 'V6B3K9'
  },
  orgAttorneyAddress: {
    streetAddress: '456 Legal Ave',
    city: 'Victoria',
    provinceState: 'BC',
    postalcodeZipcode: 'V8V1Z4'
  }
}

const mockOrgBalanceInfo = {
  totalBalance: 15000,
  reservedBalance: -2500
}

const mockUnregisteredOrgData = {
  ...mockOrgData,
  orgStatus: {
    status: 'unregistered'
  }
}

const mockMinimalOrgData = {
  name: 'Minimal Org',
  orgStatus: {
    status: 'unregistered'
  }
}

describe('OrganizationProfile Component', () => {
  const mockHasRoles = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()

    // Mock the formatters
    vi.mocked(formatters.phoneNumberFormatter).mockImplementation(
      ({ value }) =>
        value
          ? `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`
          : ''
    )

    // Mock the address constructor
    vi.mocked(addressUtils.constructAddress).mockImplementation((address) => {
      if (!address) return ''
      return `${address.streetAddress}, ${address.city}, ${address.provinceState} ${address.postalcodeZipcode}`
    })

    // Default hasRoles implementation
    mockHasRoles.mockImplementation((role) => false)
  })

  describe('Basic Rendering', () => {
    it('renders organization basic information', () => {
      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      expect(screen.getByText('Test Organization')).toBeInTheDocument()
      expect(screen.getByText('Test Org')).toBeInTheDocument()
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })

    it('handles undefined orgData gracefully', () => {
      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={undefined}
          orgBalanceInfo={null}
        />,
        { wrapper }
      )

      // Should not crash and should render basic structure
      expect(screen.getAllByTestId('bc-box').length).toBeGreaterThan(0)
    })
  })

  describe('Phone Number Formatting', () => {
    it('formats phone number correctly', () => {
      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      expect(formatters.phoneNumberFormatter).toHaveBeenCalledWith({
        value: '6041234567'
      })
      expect(screen.getByText('(604) 123-4567')).toBeInTheDocument()
    })

    it('handles missing phone number', () => {
      const orgDataWithoutPhone = { ...mockOrgData, phone: undefined }

      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={orgDataWithoutPhone}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      expect(formatters.phoneNumberFormatter).toHaveBeenCalledWith({
        value: undefined
      })
    })
  })

  describe('Address Construction', () => {
    it('constructs service and attorney addresses', () => {
      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      expect(addressUtils.constructAddress).toHaveBeenCalledWith(
        mockOrgData.orgAddress
      )
      expect(addressUtils.constructAddress).toHaveBeenCalledWith(
        mockOrgData.orgAttorneyAddress
      )

      expect(
        screen.getByText('123 Main St, Vancouver, BC V6B3K9')
      ).toBeInTheDocument()
      expect(
        screen.getByText('456 Legal Ave, Victoria, BC V8V1Z4')
      ).toBeInTheDocument()
    })

    it('handles missing addresses gracefully', () => {
      const orgDataWithoutAddresses = {
        ...mockOrgData,
        orgAddress: undefined,
        orgAttorneyAddress: undefined
      }

      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={orgDataWithoutAddresses}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      expect(addressUtils.constructAddress).toHaveBeenCalledWith(undefined)
    })
  })

  describe('Operating Name Fallback', () => {
    it('uses legal name when operating name is missing', () => {
      const orgDataWithoutOperatingName = {
        ...mockOrgData,
        operatingName: undefined
      }

      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={orgDataWithoutOperatingName}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      // Should show legal name twice (once for legal name, once for operating name fallback)
      const legalNameElements = screen.getAllByText('Test Organization')
      expect(legalNameElements.length).toBeGreaterThanOrEqual(2)
    })

    it('uses operating name when available', () => {
      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      expect(screen.getByText('Test Org')).toBeInTheDocument()
    })
  })

  describe('Role-Based Rendering', () => {
    it('shows compliance unit balance for government users', () => {
      mockHasRoles.mockImplementation((role) => role === 'government')

      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      // Use more flexible text matching for numbers that might be separated by whitespace
      expect(
        screen.getByText((content, element) => {
          return content.includes('15,000')
        })
      ).toBeInTheDocument()

      expect(
        screen.getByText((content, element) => {
          return content.includes('2,500')
        })
      ).toBeInTheDocument()
    })

    it('shows update message for non-government users when not loading', () => {
      mockHasRoles.mockImplementation(() => false)

      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      // Look for the email link within the update message
      expect(screen.getByRole('link')).toBeInTheDocument()

      // Also check for the prefix and suffix text
      expect(
        screen.getByText((content) => content.includes('org:toUpdateMsgPrefix'))
      ).toBeInTheDocument()
    })

    it('hides update message for government users', () => {
      mockHasRoles.mockImplementation((role) => role === 'government')

      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      expect(
        screen.queryByText((content) =>
          content.includes('org:toUpdateMsgPrefix')
        )
      ).not.toBeInTheDocument()
    })

    it('hides update message when user is loading', () => {
      mockHasRoles.mockImplementation(() => false)

      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={true}
          orgData={mockOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      expect(
        screen.queryByText((content) =>
          content.includes('org:toUpdateMsgPrefix')
        )
      ).not.toBeInTheDocument()
    })
  })

  describe('Organization Status and Registration', () => {
    it('shows registered transfer status for registered organizations', () => {
      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      expect(screen.getByText('org:registeredTransferYes')).toBeInTheDocument()
    })

    it('shows unregistered transfer status for unregistered organizations', () => {
      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockUnregisteredOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      expect(screen.getByText('org:registeredTransferNo')).toBeInTheDocument()
    })

    it('hides credit trading for unregistered organizations', () => {
      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockUnregisteredOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      // Should not show credit trading enabled section
      expect(
        screen.queryByText('org:creditTradingEnabledLabel')
      ).not.toBeInTheDocument()
    })
  })

  describe('Conditional Fields', () => {
    it('shows records address when available', () => {
      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      expect(
        screen.getByText('789 Records St, Vancouver, BC')
      ).toBeInTheDocument()
    })

    it('hides records address when not available', () => {
      const orgDataWithoutRecords = {
        ...mockOrgData,
        recordsAddress: undefined
      }

      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={orgDataWithoutRecords}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      expect(
        screen.queryByText('org:bcRecordLabelShort')
      ).not.toBeInTheDocument()
    })

    it('shows early issuance for government users', () => {
      mockHasRoles.mockImplementation((role) => role === 'government')

      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName === 'STRONG' &&
            content.includes('org:earlyIssuanceIndicator')
          )
        })
      ).toBeInTheDocument()
    })

    it('shows early issuance for organizations that have it enabled', () => {
      mockHasRoles.mockImplementation(() => false)

      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      // Should show because orgData.hasEarlyIssuance is true
      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName === 'STRONG' &&
            content.includes('org:earlyIssuanceIndicator')
          )
        })
      ).toBeInTheDocument()
    })

    it('hides early issuance when not government and org does not have it', () => {
      mockHasRoles.mockImplementation(() => false)
      const orgDataWithoutEarlyIssuance = {
        ...mockOrgData,
        hasEarlyIssuance: false
      }

      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={orgDataWithoutEarlyIssuance}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      expect(
        screen.queryByText((content, element) => {
          return (
            element?.tagName === 'STRONG' &&
            content.includes('org:earlyIssuanceIndicator')
          )
        })
      ).not.toBeInTheDocument()
    })
  })

  describe('Balance Information', () => {
    it('displays balance with correct format', () => {
      mockHasRoles.mockImplementation((role) => role === 'government')

      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      // The balance should be displayed as: "15,000 (2,500)"
      // Look for the role component that contains the balance
      const roleElement = screen.getByTestId('role')
      expect(roleElement).toBeInTheDocument()

      // Check that both numbers are present in the balance display
      expect(
        screen.getByText((content) => content.includes('15,000'))
      ).toBeInTheDocument()
      expect(
        screen.getByText((content) => content.includes('2,500'))
      ).toBeInTheDocument()
    })

    it('handles missing balance info gracefully', () => {
      mockHasRoles.mockImplementation((role) => role === 'government')

      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockOrgData}
          orgBalanceInfo={null}
        />,
        { wrapper }
      )

      // Should not crash, and balance section should be rendered
      expect(screen.getByTestId('role')).toBeInTheDocument()
    })

    it('handles negative reserved balance correctly', () => {
      mockHasRoles.mockImplementation((role) => role === 'government')
      const balanceWithNegative = {
        totalBalance: 10000,
        reservedBalance: -5000
      }

      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockOrgData}
          orgBalanceInfo={balanceWithNegative}
        />,
        { wrapper }
      )

      expect(
        screen.getByText((content) => content.includes('10,000'))
      ).toBeInTheDocument()
      expect(
        screen.getByText((content) => content.includes('5,000'))
      ).toBeInTheDocument() // Math.abs(-5000)
    })
  })

  describe('Translation Integration', () => {
    it('uses translation keys for all labels', () => {
      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      // Check for translation key patterns in strong elements (labels)
      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName === 'STRONG' &&
            content.includes('org:legalNameLabel')
          )
        })
      ).toBeInTheDocument()

      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName === 'STRONG' &&
            content.includes('org:operatingNameLabel')
          )
        })
      ).toBeInTheDocument()

      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName === 'STRONG' &&
            content.includes('org:phoneNbrLabel')
          )
        })
      ).toBeInTheDocument()

      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName === 'STRONG' &&
            content.includes('org:emailAddrLabel')
          )
        })
      ).toBeInTheDocument()
    })

    it('uses correct translation for registration status', () => {
      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      // Should show the "Yes" translation for registered organizations
      expect(screen.getByText('org:registeredTransferYes')).toBeInTheDocument()
    })

    it('uses correct translation for unregistered status', () => {
      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockUnregisteredOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      // Should show the "No" translation for unregistered organizations
      expect(screen.getByText('org:registeredTransferNo')).toBeInTheDocument()
    })
  })

  describe('Component Structure', () => {
    it('renders correct grid layout structure', () => {
      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      const boxes = screen.getAllByTestId('bc-box')
      expect(boxes.length).toBeGreaterThanOrEqual(3) // Main container + grid + columns
    })

    it('renders typography elements with correct variants', () => {
      render(
        <OrganizationProfile
          hasRoles={mockHasRoles}
          isCurrentUserLoading={false}
          orgData={mockOrgData}
          orgBalanceInfo={mockOrgBalanceInfo}
        />,
        { wrapper }
      )

      const typographyElements = screen.getAllByTestId('bc-typography')
      typographyElements.forEach((element) => {
        expect(element).toHaveAttribute('data-variant', 'body4')
      })
    })
  })
})
