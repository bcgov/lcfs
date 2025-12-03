import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})