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
const mockSaveMissingInformation = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useDesignatedActionProfile: () => mockProfile(),
  useSetRecommendedCredits: () => ({ mutate: vi.fn() }),
  useSetMissingInformation: () => ({ mutate: mockSaveMissingInformation }),
  useEvidenceRequirements: () => ({
    data: [{ evidenceRequirementId: 1, reviewOutcome: 'Satisfactory' }]
  })
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
  // The tree owns the section's card and header, so the page's own
  // controls reach the screen through it.
  DocumentTree: ({ title, headerAction, allowSubfolders }) => (
    <div
      data-test="document-tree"
      data-allow-subfolders={allowSubfolders ? 'true' : 'false'}
    >
      <span>{title}</span>
      {headerAction}
    </div>
  )
}))

vi.mock('../components/EvidenceOfCompletion', () => ({
  // The section takes the evidence decisions as a slot (#5080) and the
  // Missing information box's text from the page (#5118); the stub
  // renders both so the page's wiring is observable.
  EvidenceOfCompletion: ({
    actions,
    missingInformation,
    onMissingInformationChange,
    onMissingInformationBlur,
    missingInformationReadOnly
  }) => (
    <div data-test="evidence-of-completion">
      <textarea
        data-test="missing-information-stub"
        value={missingInformation}
        readOnly={missingInformationReadOnly}
        onChange={(event) => onMissingInformationChange(event.target.value)}
        onBlur={onMissingInformationBlur}
      />
      {actions}
    </div>
  )
}))

vi.mock('../components/DesignatedActionHistoryPanel', () => ({
  DesignatedActionHistoryPanel: () => (
    <div data-test="designated-action-history" />
  )
}))

vi.mock('../components/EditDesignatedAction', () => ({
  EditDesignatedAction: () => <div data-test="edit-designated-action" />
}))

const workflowProps = vi.fn()
vi.mock('../components/DesignatedActionWorkflow', () => ({
  PLACEMENT_EVIDENCE: 'evidence',
  PLACEMENT_DECISION: 'decision',
  DesignatedActionWorkflow: (props) => {
    workflowProps(props)
    return <div data-test={`designated-action-workflow-${props.placement}`} />
  }
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
  siblingActionIds: [9, 12, 15],
  missingInformation: 'The signed stage two permit.',
  availableActions: ['accept_evidence', 'recommend_to_manager']
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

  it('publishes the action identifier and its agreement to the breadcrumb store', () => {
    render(<DesignatedActionDetail />, { wrapper })
    const store = useInitiativeAgreementPageStore.getState()
    expect(store.agreementCrumb).toBe('DA1-IA5')
    // The agreement segment before the action gets the agreement's code,
    // so the trail reads module > agreement > action.
    expect(store.parentCrumb).toBe('IA-26ORG1')
  })

  it('offers document upload to IDIR IA roles only', () => {
    render(<DesignatedActionDetail />, { wrapper })
    expect(screen.getByTestId('upload-documents-button')).toBeInTheDocument()
  })

  it('renders the folder tree in the documents section', () => {
    render(<DesignatedActionDetail />, { wrapper })
    expect(screen.getByTestId('document-tree')).toBeInTheDocument()
  })

  it('turns subfolders on, per the business area (2026-09-01)', () => {
    render(<DesignatedActionDetail />, { wrapper })
    // The tree defaults nesting off; this page is where the product
    // decision to allow it lives.
    expect(screen.getByTestId('document-tree')).toHaveAttribute(
      'data-allow-subfolders',
      'true'
    )
  })

  it('renders the evidence of completion section', () => {
    render(<DesignatedActionDetail />, { wrapper })
    expect(screen.getByTestId('evidence-of-completion')).toBeInTheDocument()
  })

  it('passes the available actions and evidence state to the workflow', () => {
    render(<DesignatedActionDetail />, { wrapper })

    // Rendered twice (#5080): the evidence decisions inside the evidence
    // section, the recommendation decisions after it. Both get the same
    // facts.
    const evidence = screen.getByTestId('designated-action-workflow-evidence')
    expect(screen.getByTestId('evidence-of-completion')).toContainElement(
      evidence
    )
    const decision = screen.getByTestId('designated-action-workflow-decision')
    expect(screen.getByTestId('evidence-of-completion')).not.toContainElement(
      decision
    )
    for (const placement of ['evidence', 'decision']) {
      expect(workflowProps).toHaveBeenCalledWith(
        expect.objectContaining({
          placement,
          availableActions: ['accept_evidence', 'recommend_to_manager'],
          allEvidenceSatisfactory: true,
          // The amount is edited in the header now (#5079); the workflow
          // only carries the saved value into the recommend action.
          recommendedCredits: null
        })
      )
    }
  })

  it('puts the evidence review and the recommendation inside the action card (#5118)', () => {
    render(<DesignatedActionDetail />, { wrapper })

    // Box within a box: the evidence section is its own box inside the
    // card, and the recommendation sits beneath it, still in the card.
    const card = screen.getByTestId('designated-action-card')
    expect(card).toContainElement(screen.getByTestId('evidence-of-completion'))
    expect(card).toContainElement(
      screen.getByTestId('designated-action-workflow-decision')
    )
    // The activity trail and comments stay outside it.
    expect(card).not.toContainElement(
      screen.getByTestId('designated-action-history')
    )
  })

  it('shows the saved missing information and saves it on leaving the box', () => {
    render(<DesignatedActionDetail />, { wrapper })

    const box = screen.getByTestId('missing-information-stub')
    expect(box).toHaveValue('The signed stage two permit.')

    fireEvent.change(box, { target: { value: 'The risk register too.' } })
    // The request button sends what is in the box, saved or not.
    expect(workflowProps).toHaveBeenCalledWith(
      expect.objectContaining({
        placement: 'evidence',
        missingInformation: 'The risk register too.'
      })
    )
    fireEvent.blur(box)
    expect(mockSaveMissingInformation).toHaveBeenCalledWith(
      'The risk register too.'
    )
  })

  it('does not save the missing information when it has not changed', () => {
    render(<DesignatedActionDetail />, { wrapper })

    fireEvent.blur(screen.getByTestId('missing-information-stub'))

    expect(mockSaveMissingInformation).not.toHaveBeenCalled()
  })

  it('shows directors the missing information without letting them edit it', () => {
    mockRoles = [{ name: roles.director }]
    render(<DesignatedActionDetail />, { wrapper })

    expect(screen.getByTestId('missing-information-stub')).toHaveAttribute(
      'readonly'
    )
  })

  it('offers the edit control on the action card', () => {
    render(<DesignatedActionDetail />, { wrapper })
    expect(screen.getByTestId('edit-designated-action')).toBeInTheDocument()
  })

  it('renders the audit trail panel', () => {
    render(<DesignatedActionDetail />, { wrapper })
    expect(screen.getByTestId('designated-action-history')).toBeInTheDocument()
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
