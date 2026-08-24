import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { roles } from '@/constants/roles'
import { wrapper } from '@/tests/utils/wrapper'
import { InitiativeAgreementDetail } from '../InitiativeAgreementDetail'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: { token: 'mock-token', authenticated: true, initialized: true }
  })
}))

let mockRoles = [{ name: roles.ia_analyst }]
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { roles: mockRoles },
    hasRoles: (...names) => names.some((n) => mockRoles.some((r) => r.name === n)),
    hasAnyRole: (...names) =>
      names.some((n) => mockRoles.some((r) => r.name === n))
  })
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useParams: () => ({ initiativeAgreementId: '5' }) }
})

const mockAgreement = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useGetInitiativeAgreement: () => mockAgreement()
}))

const mockDocuments = vi.fn()
vi.mock('@/hooks/useDocuments', () => ({
  useDocuments: () => mockDocuments(),
  useDownloadDocument: () => vi.fn()
}))

vi.mock('@/components/Documents/DocumentUploadDialog', () => ({
  default: ({ open }) =>
    open ? <div data-test="upload-dialog" /> : null
}))

const agreement = {
  initiativeAgreementId: 5,
  iaCode: 'IA-26ORG1',
  title: 'Renewable Fuels Production Facility',
  projectDescription: 'A description of the project.',
  agreementStartDate: '2026-06-19',
  agreementEndDate: '2027-05-03',
  lifecycleStatus: { status: 'Underway' },
  organization: {
    organizationId: 1,
    name: 'Test Organization',
    phone: '604-555-0100',
    email: 'contact@example.com',
    orgAddress: {
      streetAddress: '697 Burrard Street',
      city: 'Vancouver',
      provinceState: 'BC',
      country: 'Canada',
      postalcodeZipcode: 'V6G 2P3'
    }
  }
}

describe('InitiativeAgreementDetail', () => {
  beforeEach(() => {
    mockRoles = [{ name: roles.ia_analyst }]
    mockAgreement.mockReturnValue({
      data: agreement,
      isLoading: false,
      isError: false,
      error: null
    })
    mockDocuments.mockReturnValue({ data: [], refetch: vi.fn() })
  })

  it('renders the agreement card with organization, status and dates', () => {
    render(<InitiativeAgreementDetail />, { wrapper })

    expect(screen.getByTestId('initiative-agreement-detail-title')).toHaveTextContent(
      'IA-26ORG1'
    )
    expect(screen.getByText('Test Organization')).toBeInTheDocument()
    expect(screen.getByTestId('agreement-status-chip')).toHaveTextContent(
      'Underway'
    )
    expect(screen.getByText(/697 Burrard Street/)).toBeInTheDocument()
    expect(screen.getByText('604-555-0100')).toBeInTheDocument()
    expect(screen.getByText('IA5')).toBeInTheDocument()
  })

  it('renders the agreement brief', () => {
    render(<InitiativeAgreementDetail />, { wrapper })
    expect(
      screen.getByText('Renewable Fuels Production Facility')
    ).toBeInTheDocument()
    expect(screen.getByText('A description of the project.')).toBeInTheDocument()
  })

  it('offers document upload to an IA analyst', () => {
    render(<InitiativeAgreementDetail />, { wrapper })
    expect(screen.getByTestId('upload-documents-button')).toBeInTheDocument()
  })

  it('does not offer document upload to a BCeID proponent', () => {
    mockRoles = [{ name: roles.ia_proponent }]
    render(<InitiativeAgreementDetail />, { wrapper })
    expect(screen.queryByTestId('upload-documents-button')).not.toBeInTheDocument()
  })

  it('renders an empty state when the agreement has no documents', () => {
    render(<InitiativeAgreementDetail />, { wrapper })
    expect(
      screen.getByText('initiativeAgreement:detail.noDocuments')
    ).toBeInTheDocument()
  })

  it('surfaces a load failure instead of a blank card', () => {
    mockAgreement.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: 'boom' }
    })
    render(<InitiativeAgreementDetail />, { wrapper })
    expect(screen.getByTestId('alert-box')).toHaveTextContent('boom')
  })

  it('tolerates an organization with no address', () => {
    mockAgreement.mockReturnValue({
      data: {
        ...agreement,
        organization: { organizationId: 1, name: 'Test Organization' }
      },
      isLoading: false,
      isError: false,
      error: null
    })
    render(<InitiativeAgreementDetail />, { wrapper })
    expect(screen.getByText('Test Organization')).toBeInTheDocument()
  })
})
