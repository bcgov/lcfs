import React from 'react'
import { describe, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { OrgDetailsCard } from '../OrgDetailsCard'
import { test } from '@/tests/utils/fixtures'
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

  test('renders organization name and addresses', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <OrgDetailsCard
        orgName="Test Organization"
        orgAddress={mockOrgAddress}
        orgAttorneyAddress={mockAttorneyAddress}
        contactName="Jane Contact"
      />,
      [query, theme, localization, router]
    )

    expect(screen.getByText('report:orgDetails')).toBeInTheDocument()
    expect(screen.getByText('Test Organization')).toBeInTheDocument()
    expect(screen.getByText('org:contactNameLabel:')).toBeInTheDocument()
    expect(screen.getByText('Jane Contact')).toBeInTheDocument()

    expect(screen.getByText('report:serviceAddrLabel:')).toBeInTheDocument()
    expect(
      screen.getByText('123 Main St., Victoria, BC, V1A 2B3')
    ).toBeInTheDocument()

    expect(screen.getByText('report:bcAddrLabel:')).toBeInTheDocument()
    expect(
      screen.getByText('456 Second Ave., Vancouver, BC, V2C 3D4')
    ).toBeInTheDocument()
  })

  test('does not render contact name when not provided', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <OrgDetailsCard
        orgName="Test Organization"
        orgAddress={mockOrgAddress}
        orgAttorneyAddress={mockAttorneyAddress}
      />,
      [query, theme, localization, router]
    )

    expect(screen.queryByText('org:contactNameLabel:')).not.toBeInTheDocument()
  })

  test('renders contact message if not a government user', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <OrgDetailsCard
        orgName="Test Organization"
        orgAddress={mockOrgAddress}
        orgAttorneyAddress={mockAttorneyAddress}
        isGovernmentUser={false}
      />,
      [query, theme, localization, router]
    )

    expect(
      screen.getByText('report:contactForAddrChange', { exact: false })
    ).toBeInTheDocument()
  })

  test('does NOT render contact message if government user', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <OrgDetailsCard
        orgName="Test Organization"
        orgAddress={mockOrgAddress}
        orgAttorneyAddress={mockAttorneyAddress}
        isGovernmentUser={true}
      />,
      [query, theme, localization, router]
    )

    expect(
      screen.queryByText('report:contactForAddrChange', { exact: false })
    ).not.toBeInTheDocument()
  })

  test('renders empty addresses gracefully when not provided', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<OrgDetailsCard orgName="Test Organization" />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('report:orgDetails')).toBeInTheDocument()
    expect(screen.getByText('Test Organization')).toBeInTheDocument()
    expect(screen.getByText('report:serviceAddrLabel:')).toBeInTheDocument()
    expect(screen.getByText('report:bcAddrLabel:')).toBeInTheDocument()

    expect(constructAddress).not.toHaveBeenCalled() // No addresses provided
  })

  test('renders only service address when attorney address is null', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <OrgDetailsCard
        orgName="Test Organization"
        orgAddress={mockOrgAddress}
        orgAttorneyAddress={null}
      />,
      [query, theme, localization, router]
    )

    expect(screen.getByText('Test Organization')).toBeInTheDocument()
    expect(
      screen.getByText('123 Main St., Victoria, BC, V1A 2B3')
    ).toBeInTheDocument()
    expect(screen.getByText('report:bcAddrLabel:')).toBeInTheDocument()

    expect(constructAddress).toHaveBeenCalledTimes(1)
    expect(constructAddress).toHaveBeenCalledWith(mockOrgAddress)
  })

  test('renders only attorney address when service address is null', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <OrgDetailsCard
        orgName="Test Organization"
        orgAddress={null}
        orgAttorneyAddress={mockAttorneyAddress}
      />,
      [query, theme, localization, router]
    )

    expect(screen.getByText('Test Organization')).toBeInTheDocument()
    expect(
      screen.getByText('456 Second Ave., Vancouver, BC, V2C 3D4')
    ).toBeInTheDocument()
    expect(screen.getByText('report:serviceAddrLabel:')).toBeInTheDocument()

    expect(constructAddress).toHaveBeenCalledTimes(1)
    expect(constructAddress).toHaveBeenCalledWith(mockAttorneyAddress)
  })

  test('uses default isGovernmentUser=false when not provided', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <OrgDetailsCard
        orgName="Test Organization"
        orgAddress={mockOrgAddress}
        orgAttorneyAddress={mockAttorneyAddress}
      />,
      [query, theme, localization, router]
    )

    // Should show contact message when isGovernmentUser defaults to false
    expect(
      screen.getByText('report:contactForAddrChange', { exact: false })
    ).toBeInTheDocument()
  })

  test('renders all translation keys correctly', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <OrgDetailsCard
        orgName="Test Organization"
        orgAddress={mockOrgAddress}
        orgAttorneyAddress={mockAttorneyAddress}
        isGovernmentUser={false}
      />,
      [query, theme, localization, router]
    )

    // Verify all translation keys are rendered
    expect(screen.getByText('report:orgDetails')).toBeInTheDocument()
    expect(screen.getByText('report:serviceAddrLabel:')).toBeInTheDocument()
    expect(screen.getByText('report:bcAddrLabel:')).toBeInTheDocument()
    expect(
      screen.getByText('report:contactForAddrChange', { exact: false })
    ).toBeInTheDocument()
  })

  test('handles undefined addresses properly', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <OrgDetailsCard
        orgName="Test Organization"
        orgAddress={undefined}
        orgAttorneyAddress={undefined}
        isGovernmentUser={false}
      />,
      [query, theme, localization, router]
    )

    expect(screen.getByText('Test Organization')).toBeInTheDocument()
    expect(screen.getByText('report:serviceAddrLabel:')).toBeInTheDocument()
    expect(screen.getByText('report:bcAddrLabel:')).toBeInTheDocument()
    expect(constructAddress).not.toHaveBeenCalled()
  })

  test('calls constructAddress with correct parameters when addresses are provided', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <OrgDetailsCard
        orgName="Test Organization"
        orgAddress={mockOrgAddress}
        orgAttorneyAddress={mockAttorneyAddress}
      />,
      [query, theme, localization, router]
    )

    expect(constructAddress).toHaveBeenCalledTimes(2)
    expect(constructAddress).toHaveBeenNthCalledWith(1, mockOrgAddress)
    expect(constructAddress).toHaveBeenNthCalledWith(2, mockAttorneyAddress)
  })

  test('renders with minimal required props', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<OrgDetailsCard orgName="Minimal Test Org" />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('Minimal Test Org')).toBeInTheDocument()
    expect(screen.getByText('report:orgDetails')).toBeInTheDocument()
  })
})
