import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChargingSiteProfile } from '../../components/ChargingSiteProfile'
import { wrapper } from '@/tests/utils/wrapper.jsx'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/utils/grid/cellRenderers', () => ({
  createStatusRenderer: () => ({ data }) => <span>{data?.status?.status}</span>
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
    organization: { name: 'Test Organization' }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders site profile information', () => {
    render(<ChargingSiteProfile data={mockData} />, { wrapper })
    
    expect(screen.getByText('Test Charging Site')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('CS001')).toBeInTheDocument()
  })

  it('displays address information', () => {
    render(<ChargingSiteProfile data={mockData} />, { wrapper })

    expect(screen.getByText('123 Main St, Vancouver, V6B 1A1')).toBeInTheDocument()
  })

  it('displays notes', () => {
    render(<ChargingSiteProfile data={mockData} />, { wrapper })
    
    expect(screen.getByText('Test notes')).toBeInTheDocument()
  })

  it('shows organization for government users', () => {
    render(<ChargingSiteProfile data={mockData} />, { wrapper })
    
    expect(screen.getByText('Test Organization')).toBeInTheDocument()
  })

  it('handles missing data gracefully', () => {
    const incompleteData = {
      siteName: 'Test Site',
      status: { status: 'Draft' },
      streetAddress: '',
      city: '',
      postalCode: ''
    }
    
    render(<ChargingSiteProfile data={incompleteData} />, { wrapper })
    
    expect(screen.getByText('Test Site')).toBeInTheDocument()
    expect(screen.getByText(', ,')).toBeInTheDocument()
  })

  describe('manual status buttons', () => {
    const setValidatedLabel = 'buttons.setAsValidated'
    const submitUpdatesLabel = 'buttons.submitUpdates'

    it('shows "Set as validated" when IDIR Analyst and status is Submitted', () => {
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
        { wrapper }
      )
      expect(screen.getByRole('button', { name: setValidatedLabel })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: submitUpdatesLabel })).not.toBeInTheDocument()
    })

    it('does not show "Set as validated" when IDIR but not Analyst and status is Submitted', () => {
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
        { wrapper }
      )
      expect(screen.queryByRole('button', { name: setValidatedLabel })).not.toBeInTheDocument()
    })

    it('does not show "Submit updates" when BCeID Compliance and status is Draft', () => {
      const hasAnyRole = vi.fn((...roles) => roles.includes('Compliance Reporting'))
      render(
        <ChargingSiteProfile
          data={mockData}
          hasAnyRole={hasAnyRole}
          hasRoles={vi.fn(() => false)}
          isIDIR={false}
          refetch={vi.fn()}
        />,
        { wrapper }
      )
      expect(screen.queryByRole('button', { name: submitUpdatesLabel })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: setValidatedLabel })).not.toBeInTheDocument()
    })

    it('shows "Submit updates" when BCeID Compliance and status is Updated', () => {
      const hasAnyRole = vi.fn((...roles) => roles.includes('Compliance Reporting'))
      const updatedData = { ...mockData, status: { status: 'Updated' } }
      render(
        <ChargingSiteProfile
          data={updatedData}
          hasAnyRole={hasAnyRole}
          hasRoles={vi.fn(() => false)}
          isIDIR={false}
          refetch={vi.fn()}
        />,
        { wrapper }
      )
      expect(screen.getByRole('button', { name: submitUpdatesLabel })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: setValidatedLabel })).not.toBeInTheDocument()
    })

    it('does not show status buttons when status is Validated', () => {
      const validatedData = { ...mockData, status: { status: 'Validated' } }
      render(
        <ChargingSiteProfile
          data={validatedData}
          hasAnyRole={vi.fn(() => true)}
          hasRoles={vi.fn(() => false)}
          isIDIR={true}
          refetch={vi.fn()}
        />,
        { wrapper }
      )
      expect(screen.queryByRole('button', { name: setValidatedLabel })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: submitUpdatesLabel })).not.toBeInTheDocument()
    })

    it('calls mutation with Validated when "Set as validated" is clicked', () => {
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
        { wrapper }
      )
      fireEvent.click(screen.getByRole('button', { name: setValidatedLabel }))
      expect(mockMutate).toHaveBeenCalledWith(
        { siteId: '57', newStatus: 'Validated' },
        expect.objectContaining({ onSettled: expect.any(Function) })
      )
    })

    it('calls mutation with Submitted when "Submit updates" is clicked', () => {
      const hasAnyRole = vi.fn((...roles) => roles.includes('Compliance Reporting'))
      const updatedData = { ...mockData, status: { status: 'Updated' } }
      render(
        <ChargingSiteProfile
          data={updatedData}
          hasAnyRole={hasAnyRole}
          hasRoles={vi.fn(() => false)}
          isIDIR={false}
          refetch={vi.fn()}
        />,
        { wrapper }
      )
      fireEvent.click(screen.getByRole('button', { name: submitUpdatesLabel }))
      expect(mockMutate).toHaveBeenCalledWith(
        { siteId: '57', newStatus: 'Submitted' },
        expect.objectContaining({ onSettled: expect.any(Function) })
      )
    })
  })
})
