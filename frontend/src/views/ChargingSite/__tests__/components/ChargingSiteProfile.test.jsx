import React from 'react'
import { describe, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { ChargingSiteProfile } from '../../components/ChargingSiteProfile'
import { test } from '@/tests/utils/fixtures'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/utils/grid/cellRenderers', () => ({
  createStatusRenderer:
    () =>
    ({ data }) => <span>{data?.status?.status}</span>
}))

vi.mock('@/components/Role', () => ({
  Role: ({ children }) => <div>{children}</div>
}))

const mockMutate = vi.fn()
vi.mock('@/hooks/useChargingSite', () => ({
  useUpdateChargingSiteStatus: () => ({
    mutate: mockMutate,
    isPending: false
  })
}))

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useParams: () => ({ siteId: '57' })
}))

describe('ChargingSiteProfile', () => {
  const mockData = {
    siteName: 'Test Charging Site',
    status: { status: 'Draft' },
    version: 1,
    siteCode: 'CS001',
    streetAddress: '123 Main St',
    city: 'Vancouver',
    postalCode: 'V6B 1A1',
    notes: 'Test notes',
    organization: { name: 'Test Organization' },
    allocatingOrganization: { name: 'Allocating Org Ltd' },
    allocatingOrganizationName: null
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders site profile information', ({ render, theme, router }) => {
    render(<ChargingSiteProfile data={mockData} />, [theme, router])

    expect(screen.getByText('Test Charging Site')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('CS001')).toBeInTheDocument()
  })

  test('displays address information', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ChargingSiteProfile data={mockData} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(
      screen.getByText('123 Main St, Vancouver, V6B 1A1')
    ).toBeInTheDocument()
  })

  test('displays notes', ({ render, query, theme, localization, router }) => {
    render(<ChargingSiteProfile data={mockData} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('Test notes')).toBeInTheDocument()
  })

  test('displays allocating organization name when available', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ChargingSiteProfile data={mockData} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('Allocating Org Ltd')).toBeInTheDocument()
  })

  test('falls back to allocatingOrganizationName string when nested object is absent', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const dataWithNameOnly = {
      ...mockData,
      allocatingOrganization: null,
      allocatingOrganizationName: 'Fallback Org'
    }
    render(<ChargingSiteProfile data={dataWithNameOnly} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('Fallback Org')).toBeInTheDocument()
  })

  test('displays N/A when allocating organization is null', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const dataWithoutAllocating = {
      ...mockData,
      allocatingOrganization: null,
      allocatingOrganizationName: null
    }
    render(<ChargingSiteProfile data={dataWithoutAllocating} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('N/A')).toBeInTheDocument()
  })

  test('renders allocating organization below site address', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ChargingSiteProfile data={mockData} />, [
      query,
      theme,
      localization,
      router
    ])

    const addressText = screen.getByText('123 Main St, Vancouver, V6B 1A1')
    const allocatingText = screen.getByText('Allocating Org Ltd')

    expect(
      addressText.compareDocumentPosition(allocatingText) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  test('shows organization for government users', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ChargingSiteProfile data={mockData} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('Test Organization')).toBeInTheDocument()
  })

  test('handles missing data gracefully', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const incompleteData = {
      siteName: 'Test Site',
      status: { status: 'Draft' },
      streetAddress: '',
      city: '',
      postalCode: ''
    }

    render(<ChargingSiteProfile data={incompleteData} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('Test Site')).toBeInTheDocument()
    expect(screen.getByText(', ,')).toBeInTheDocument()
  })

  describe('manual status buttons', () => {
    const setValidatedLabel = 'buttons.setAsValidated'
    const submitUpdatesLabel = 'buttons.submitUpdates'

    test('shows "Set as validated" when IDIR Analyst and status is Submitted', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const hasAnyRole = vi.fn((...roles) => roles.includes('Analyst'))
      const submittedData = { ...mockData, status: { status: 'Submitted' } }
      render(
        <ChargingSiteProfile
          data={submittedData}
          hasAnyRole={hasAnyRole}
          hasRoles={vi.fn(() => false)}
          isIDIR={true}
          refetch={vi.fn()}
        />,
        [query, theme, localization, router]
      )
      expect(
        screen.getByRole('button', { name: setValidatedLabel })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: submitUpdatesLabel })
      ).not.toBeInTheDocument()
    })

    test('does not show "Set as validated" when IDIR but not Analyst and status is Submitted', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const hasAnyRole = vi.fn((...roles) => !roles.includes('Analyst'))
      const submittedData = { ...mockData, status: { status: 'Submitted' } }
      render(
        <ChargingSiteProfile
          data={submittedData}
          hasAnyRole={hasAnyRole}
          hasRoles={vi.fn(() => false)}
          isIDIR={true}
          refetch={vi.fn()}
        />,
        [query, theme, localization, router]
      )
      expect(
        screen.queryByRole('button', { name: setValidatedLabel })
      ).not.toBeInTheDocument()
    })

    test('does not show "Submit updates" when BCeID Compliance and status is Draft', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const hasAnyRole = vi.fn((...roles) =>
        roles.includes('Compliance Reporting')
      )
      render(
        <ChargingSiteProfile
          data={mockData}
          hasAnyRole={hasAnyRole}
          hasRoles={vi.fn(() => false)}
          isIDIR={false}
          refetch={vi.fn()}
        />,
        [query, theme, localization, router]
      )
      expect(
        screen.queryByRole('button', { name: submitUpdatesLabel })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: setValidatedLabel })
      ).not.toBeInTheDocument()
    })

    test('shows "Submit updates" when BCeID Compliance and status is Updated', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const hasAnyRole = vi.fn((...roles) =>
        roles.includes('Compliance Reporting')
      )
      const updatedData = { ...mockData, status: { status: 'Updated' } }
      render(
        <ChargingSiteProfile
          data={updatedData}
          hasAnyRole={hasAnyRole}
          hasRoles={vi.fn(() => false)}
          isIDIR={false}
          refetch={vi.fn()}
        />,
        [query, theme, localization, router]
      )
      expect(
        screen.getByRole('button', { name: submitUpdatesLabel })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: setValidatedLabel })
      ).not.toBeInTheDocument()
    })

    test('does not show status buttons when status is Validated', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const validatedData = { ...mockData, status: { status: 'Validated' } }
      render(
        <ChargingSiteProfile
          data={validatedData}
          hasAnyRole={vi.fn(() => true)}
          hasRoles={vi.fn(() => false)}
          isIDIR={true}
          refetch={vi.fn()}
        />,
        [query, theme, localization, router]
      )
      expect(
        screen.queryByRole('button', { name: setValidatedLabel })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: submitUpdatesLabel })
      ).not.toBeInTheDocument()
    })

    test('calls mutation with Validated when "Set as validated" is clicked', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const hasAnyRole = vi.fn((...roles) => roles.includes('Analyst'))
      const submittedData = { ...mockData, status: { status: 'Submitted' } }
      render(
        <ChargingSiteProfile
          data={submittedData}
          hasAnyRole={hasAnyRole}
          hasRoles={vi.fn(() => false)}
          isIDIR={true}
          refetch={vi.fn()}
        />,
        [query, theme, localization, router]
      )
      fireEvent.click(screen.getByRole('button', { name: setValidatedLabel }))
      expect(mockMutate).toHaveBeenCalledWith(
        { siteId: '57', newStatus: 'Validated' },
        expect.objectContaining({ onSettled: expect.any(Function) })
      )
    })

    test('calls mutation with Submitted when "Submit updates" is clicked', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const hasAnyRole = vi.fn((...roles) =>
        roles.includes('Compliance Reporting')
      )
      const updatedData = { ...mockData, status: { status: 'Updated' } }
      render(
        <ChargingSiteProfile
          data={updatedData}
          hasAnyRole={hasAnyRole}
          hasRoles={vi.fn(() => false)}
          isIDIR={false}
          refetch={vi.fn()}
        />,
        [query, theme, localization, router]
      )
      fireEvent.click(screen.getByRole('button', { name: submitUpdatesLabel }))
      expect(mockMutate).toHaveBeenCalledWith(
        { siteId: '57', newStatus: 'Submitted' },
        expect.objectContaining({ onSettled: expect.any(Function) })
      )
    })
  })
})
