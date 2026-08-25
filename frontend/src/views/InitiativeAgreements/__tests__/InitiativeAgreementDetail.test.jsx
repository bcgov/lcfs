import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { roles } from '@/constants/roles'
import { wrapper } from '@/tests/utils/wrapper'
import { InitiativeAgreementDetail } from '../InitiativeAgreementDetail'
import { useInitiativeAgreementPageStore } from '@/stores/useInitiativeAgreementPageStore'

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
    hasRoles: (...names) =>
      names.some((n) => mockRoles.some((r) => r.name === n)),
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

const commentsProps = vi.fn()
vi.mock('@/components/Comments', () => ({
  default: (props) => {
    commentsProps(props)
    return <div data-test="comments-component" />
  }
}))

const daGridProps = vi.fn()
vi.mock('../components/DesignatedActionsGrid', () => ({
  DesignatedActionsGrid: (props) => {
    daGridProps(props)
    return <div data-test="designated-actions-grid" />
  }
}))

vi.mock('@/components/Documents/DocumentUploadDialog', () => ({
  default: ({ open }) => (open ? <div data-test="upload-dialog" /> : null)
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

    expect(
      screen.getByTestId('initiative-agreement-detail-title')
    ).toHaveTextContent('IA-26ORG1')
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
    expect(
      screen.getByText('A description of the project.')
    ).toBeInTheDocument()
  })

  it('offers document upload to an IA analyst', () => {
    render(<InitiativeAgreementDetail />, { wrapper })
    expect(screen.getByTestId('upload-documents-button')).toBeInTheDocument()
  })

  it('does not offer document upload to a BCeID proponent', () => {
    mockRoles = [{ name: roles.ia_proponent }]
    render(<InitiativeAgreementDetail />, { wrapper })
    expect(
      screen.queryByTestId('upload-documents-button')
    ).not.toBeInTheDocument()
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

  it('renders document rows with size and uploading organization code', () => {
    mockDocuments.mockReturnValue({
      data: [
        {
          documentId: 9,
          fileName: 'signed-agreement.pdf',
          fileSize: 1000000,
          createDate: '2026-06-01T00:00:00Z',
          createUser: 'LCFS1_bat',
          uploadingOrganizationCode: 'BETZ'
        },
        {
          documentId: 10,
          fileName: 'award-letter.pdf',
          fileSize: 2048,
          createDate: '2026-06-02T00:00:00Z',
          createUser: 'IDIRSTAFF',
          uploadingOrganizationCode: null
        }
      ],
      refetch: vi.fn()
    })
    render(<InitiativeAgreementDetail />, { wrapper })

    expect(screen.getByText('signed-agreement.pdf')).toBeInTheDocument()
    expect(screen.getByText(/1 MB/)).toBeInTheDocument()
    expect(screen.getByText(/BETZ/)).toBeInTheDocument()
    // Government upload falls back to the government label.
    expect(screen.getByText(/gov/)).toBeInTheDocument()
  })

  it('publishes the agreement code to the breadcrumb store', () => {
    render(<InitiativeAgreementDetail />, { wrapper })
    expect(useInitiativeAgreementPageStore.getState().agreementCrumb).toBe(
      'IA-26ORG1'
    )
  })

  it('renders the designated actions grid for IDIR IA roles', () => {
    render(<InitiativeAgreementDetail />, { wrapper })

    expect(screen.getByTestId('designated-actions-grid')).toBeInTheDocument()
    expect(daGridProps).toHaveBeenCalledWith(
      expect.objectContaining({ initiativeAgreementId: '5' })
    )
  })

  it('hides the designated actions grid from a BCeID proponent', () => {
    mockRoles = [{ name: roles.ia_proponent }]
    render(<InitiativeAgreementDetail />, { wrapper })

    expect(
      screen.queryByTestId('designated-actions-grid')
    ).not.toBeInTheDocument()
  })

  it('shows the dual-mode comment thread to IDIR IA roles', () => {
    render(<InitiativeAgreementDetail />, { wrapper })

    expect(screen.getByTestId('comments-component')).toBeInTheDocument()
    expect(commentsProps).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'initiativeAgreement',
        entityId: 5,
        commentMode: 'dual'
      })
    )
  })

  it('hides the comment thread from a BCeID proponent', () => {
    mockRoles = [{ name: roles.ia_proponent }]
    render(<InitiativeAgreementDetail />, { wrapper })

    expect(screen.queryByTestId('comments-component')).not.toBeInTheDocument()
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
