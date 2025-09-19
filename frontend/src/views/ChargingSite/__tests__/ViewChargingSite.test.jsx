import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ViewChargingSite } from '../ViewChargingSite'
import { wrapper } from '@/tests/utils/wrapper.jsx'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    useParams: () => ({ siteId: '123' }),
    useNavigate: () => mockNavigate
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/components/BCAlert', () => ({
  BCAlert2: React.forwardRef(({ severity, message }, ref) => (
    <div data-testid="bc-alert" ref={ref}>
      {message}
    </div>
  ))
}))

vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useChargingSite')
vi.mock('../components/ChargingSiteCard', () => ({
  ChargingSiteCard: () => <div data-testid="charging-site-card">Card</div>
}))
vi.mock('../components/ChargingSiteDocument', () => ({
  ChargingSiteDocument: () => (
    <div data-testid="charging-site-document">Document</div>
  )
}))
vi.mock('../components/ChargingSiteFSEGrid', () => ({
  ChargingSiteFSEGrid: () => (
    <div data-testid="charging-site-fse-grid">FSE Grid</div>
  )
}))

vi.mock('@/components/Loading', () => ({
  default: () => <div data-testid="loading">Loading...</div>
}))

import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useGetChargingSiteById } from '@/hooks/useChargingSite'

describe('ViewChargingSite', () => {
  const mockChargingSiteData = {
    chargingSiteId: 123,
    siteName: 'Test Site',
    documents: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useCurrentUser.mockReturnValue({
      data: { organization: { organizationId: 1 } },
      isLoading: false,
      hasRoles: vi.fn(),
      hasAnyRole: vi.fn(() => false)
    })
    useGetChargingSiteById.mockReturnValue({
      data: mockChargingSiteData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    })
  })

  it('renders loading state', () => {
    useGetChargingSiteById.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      refetch: vi.fn()
    })

    render(<ViewChargingSite />, { wrapper })
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders error state', () => {
    useGetChargingSiteById.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      refetch: vi.fn()
    })

    render(<ViewChargingSite />, { wrapper })
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('renders view charging site with all components for BCeID user', () => {
    render(<ViewChargingSite />, { wrapper })

    expect(screen.getByText('viewTitle')).toBeInTheDocument()
    expect(screen.getByText('Card')).toBeInTheDocument()
    expect(screen.getByText('Document')).toBeInTheDocument()
    expect(screen.getByText('FSE Grid')).toBeInTheDocument()
  })

  it('renders IDIR title for government users', () => {
    useCurrentUser.mockReturnValue({
      data: { organization: { organizationId: 1 } },
      isLoading: false,
      hasRoles: vi.fn(),
      hasAnyRole: vi.fn(() => true)
    })

    render(<ViewChargingSite />, { wrapper })
    expect(screen.getByText('idirSitetitle')).toBeInTheDocument()
  })
})
