import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrgDetailsCard } from '../OrgDetailsCard'
import { wrapper } from '@/tests/utils/wrapper.jsx'
import { constructAddress } from '@/utils/constructAddress'

// Mock translation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock address formatter
vi.mock('@/utils/constructAddress', () => ({
  constructAddress: vi.fn()
}))

describe('OrgDetailsCard', () => {
  let mockOrgAddress
  let mockAttorneyAddress

  beforeEach(() => {
    vi.clearAllMocks()

    mockOrgAddress = {
      line1: '123 Main St.',
      city: 'Victoria',
      province: 'BC',
      postalCode: 'V1A 2B3'
    }

    mockAttorneyAddress = {
      line1: '456 Second Ave.',
      city: 'Vancouver',
      province: 'BC',
      postalCode: 'V2C 3D4'
    }

    constructAddress.mockImplementation(
      (address) =>
        `${address.line1}, ${address.city}, ${address.province}, ${address.postalCode}`
    )
  })

  it('renders organization name and addresses', () => {
    render(
      <OrgDetailsCard
        orgName="Test Organization"
        orgAddress={mockOrgAddress}
        orgAttorneyAddress={mockAttorneyAddress}
      />,
      { wrapper }
    )

    expect(screen.getByText('report:orgDetails')).toBeInTheDocument()
    expect(screen.getByText('Test Organization')).toBeInTheDocument()

    expect(screen.getByText('report:serviceAddrLabel:')).toBeInTheDocument()
    expect(
      screen.getByText('123 Main St., Victoria, BC, V1A 2B3')
    ).toBeInTheDocument()

    expect(screen.getByText('report:bcAddrLabel:')).toBeInTheDocument()
    expect(
      screen.getByText('456 Second Ave., Vancouver, BC, V2C 3D4')
    ).toBeInTheDocument()
  })

  it('renders contact message if not a government user', () => {
    render(
      <OrgDetailsCard
        orgName="Test Organization"
        orgAddress={mockOrgAddress}
        orgAttorneyAddress={mockAttorneyAddress}
        isGovernmentUser={false}
      />,
      { wrapper }
    )

    expect(
      screen.getByText('report:contactForAddrChange', { exact: false })
    ).toBeInTheDocument()
  })

  it('does NOT render contact message if government user', () => {
    render(
      <OrgDetailsCard
        orgName="Test Organization"
        orgAddress={mockOrgAddress}
        orgAttorneyAddress={mockAttorneyAddress}
        isGovernmentUser={true}
      />,
      { wrapper }
    )

    expect(
      screen.queryByText('report:contactForAddrChange', { exact: false })
    ).not.toBeInTheDocument()
  })

  it('renders empty addresses gracefully when not provided', () => {
    render(<OrgDetailsCard orgName="Test Organization" />, { wrapper })

    expect(screen.getByText('report:orgDetails')).toBeInTheDocument()
    expect(screen.getByText('Test Organization')).toBeInTheDocument()
    expect(screen.getByText('report:serviceAddrLabel:')).toBeInTheDocument()
    expect(screen.getByText('report:bcAddrLabel:')).toBeInTheDocument()

    expect(constructAddress).not.toHaveBeenCalled() // No addresses provided
  })
})
