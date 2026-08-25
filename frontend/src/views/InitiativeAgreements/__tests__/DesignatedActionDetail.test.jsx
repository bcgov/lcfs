import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { roles } from '@/constants/roles'
import { wrapper } from '@/tests/utils/wrapper'
import { DesignatedActionDetail } from '../DesignatedActionDetail'
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

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ initiativeAgreementId: '5', designatedActionId: '9' })
  }
})

const mockProfile = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useDesignatedActionProfile: () => mockProfile()
}))

const mockDocuments = vi.fn()
vi.mock('@/hooks/useDocuments', () => ({
  useDocuments: () => mockDocuments(),
  useDownloadDocument: () => vi.fn()
}))

vi.mock('@/components/Documents/DocumentUploadDialog', () => ({
  default: ({ open }) => (open ? <div data-test="upload-dialog" /> : null)
}))

vi.mock('../components/DocumentTree', () => ({
  DocumentTree: () => <div data-test="document-tree" />
}))

vi.mock('../components/EvidenceOfCompletion', () => ({
  EvidenceOfCompletion: () => <div data-test="evidence-of-completion" />
}))

vi.mock('@/components/Comments', () => ({
  default: () => <div data-test="comments-component" />
}))

const action = {
  designatedActionId: 9,
  actionNumber: 1,
  name: 'Environmental, Regulatory & Permitting',
  creditAllocation: 1850,
  recommendedCredits: null,
  specifiedDate: '2026-07-06',
  currentStatus: { status: 'Underway', displayOrder: 30 },
  initiativeAgreementId: 5,
  iaCode: 'IA-26ORG1',
  siblingActionIds: [9, 12, 15]
}

describe('DesignatedActionDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoles = [{ name: roles.ia_analyst }]
    mockProfile.mockReturnValue({
      data: action,
      isLoading: false,
      isError: false,
      error: null
    })
    mockDocuments.mockReturnValue({ data: [], refetch: vi.fn() })
  })

  it('renders the card with name, status, credits and dates', () => {
    render(<DesignatedActionDetail />, { wrapper })

    expect(
      screen.getByTestId('designated-action-detail-title')
    ).toHaveTextContent('IA-26ORG1')
    expect(
      screen.getByText('1. Environmental, Regulatory & Permitting')
    ).toBeInTheDocument()
    expect(screen.getByTestId('action-status-chip')).toHaveTextContent(
      'Underway'
    )
    expect(
      screen.getByText('initiativeAgreement:actionDetail.upTo')
    ).toBeInTheDocument()
    expect(screen.getByText('DA1-IA5')).toBeInTheDocument()
  })

  it('completes stepper milestones up to the current status', () => {
    render(<DesignatedActionDetail />, { wrapper })

    const stepper = screen.getByTestId('designated-action-stepper')
    const completed = stepper.querySelectorAll('.Mui-completed')
    // Underway (display order 30) completes the first two milestones.
    expect(completed.length).toBeGreaterThanOrEqual(2)
    expect(
      screen.getByText('initiativeAgreement:actionDetail.steps.approved')
    ).toBeInTheDocument()
  })

  it('navigates between sibling actions and disables the edges', () => {
    render(<DesignatedActionDetail />, { wrapper })

    const previous = screen.getByTestId('previous-action-button')
    const next = screen.getByTestId('next-action-button')
    expect(previous).toBeDisabled()
    expect(next).not.toBeDisabled()

    fireEvent.click(next)
    expect(mockNavigate).toHaveBeenCalledWith(
      '/initiative-agreements/5/designated-actions/12'
    )
  })

  it('publishes the action identifier to the breadcrumb store', () => {
    render(<DesignatedActionDetail />, { wrapper })
    expect(useInitiativeAgreementPageStore.getState().agreementCrumb).toBe(
      'DA1-IA5'
    )
  })

  it('offers document upload to IDIR IA roles only', () => {
    render(<DesignatedActionDetail />, { wrapper })
    expect(screen.getByTestId('upload-documents-button')).toBeInTheDocument()
  })

  it('renders the folder tree in the documents section', () => {
    render(<DesignatedActionDetail />, { wrapper })
    expect(screen.getByTestId('document-tree')).toBeInTheDocument()
  })

  it('renders the evidence of completion section', () => {
    render(<DesignatedActionDetail />, { wrapper })
    expect(screen.getByTestId('evidence-of-completion')).toBeInTheDocument()
  })

  it('renders the comments thread', () => {
    render(<DesignatedActionDetail />, { wrapper })
    expect(screen.getByTestId('comments-component')).toBeInTheDocument()
  })

  it('surfaces a load failure', () => {
    mockProfile.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: 'boom' }
    })
    render(<DesignatedActionDetail />, { wrapper })
    expect(screen.getByTestId('alert-box')).toHaveTextContent('boom')
  })
})
