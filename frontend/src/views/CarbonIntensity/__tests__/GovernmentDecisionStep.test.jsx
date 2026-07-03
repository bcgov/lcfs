import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'

import { roles } from '@/constants/roles'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

const mockRecordDecision = vi.fn().mockResolvedValue(null)
const mockCompleteVerification1 = vi.fn().mockResolvedValue(null)
const mockCompleteVerification2 = vi.fn().mockResolvedValue(null)
const mockRecommendToDirector = vi.fn().mockResolvedValue(null)
const mockRequestPathwayChanges = vi.fn().mockResolvedValue(null)
const mockGenerateFuelCodes = vi.fn().mockResolvedValue(null)

vi.mock('@/hooks/useCIApplication', () => ({
  useCompleteCIApplicationVerification1: vi.fn(() => ({
    mutateAsync: mockCompleteVerification1,
    isPending: false
  })),
  useCompleteCIApplicationVerification2: vi.fn(() => ({
    mutateAsync: mockCompleteVerification2,
    isPending: false
  })),
  useRecommendCIApplication: vi.fn(() => ({
    mutateAsync: mockRecommendToDirector,
    isPending: false
  })),
  useRequestCIApplicationPathwayChanges: vi.fn(() => ({
    mutateAsync: mockRequestPathwayChanges,
    isPending: false
  })),
  useGenerateCIApplicationFuelCodes: vi.fn(() => ({
    mutateAsync: mockGenerateFuelCodes,
    isPending: false
  })),
  useRecordCIDecision: vi.fn(() => ({
    mutateAsync: mockRecordDecision,
    isPending: false
  }))
}))

const mockCommentsWidget = vi.fn()
vi.mock('@/components/Comments', () => ({
  default: (props) => {
    mockCommentsWidget(props)
    return (
      <div
        data-test="shared-comments-widget"
        data-entity-type={props.entityType}
        data-entity-id={String(props.entityId)}
        data-comment-mode={props.commentMode}
      />
    )
  }
}))

let mockUserRoles = [{ name: roles.ci_applicant }]
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { roles: mockUserRoles },
    hasRoles: (...names) =>
      names.every((name) => mockUserRoles.some((r) => r.name === name)),
    hasAnyRole: (...names) =>
      names.some((name) => mockUserRoles.some((r) => r.name === name))
  })
}))

import { GovernmentDecisionStep } from '@/views/CarbonIntensity/components/GovernmentDecisionStep'

const baseCi = { ciApplicationId: 10, status: { status: 'Submitted' } }

describe('GovernmentDecisionStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserRoles = [{ name: roles.ci_applicant }]
  })
  afterEach(cleanup)

  it('renders the shared Comments widget targeting this CI application', () => {
    render(<GovernmentDecisionStep ciApplication={baseCi} />, { wrapper })

    const widget = screen.getByTestId('shared-comments-widget')
    expect(widget).toBeInTheDocument()
    expect(widget).toHaveAttribute('data-entity-type', 'ciApplication')
    expect(widget).toHaveAttribute('data-entity-id', '10')
    expect(widget).toHaveAttribute('data-comment-mode', 'dual')
  })

  it('renders the empty-thread placeholder when there is no application id', () => {
    render(<GovernmentDecisionStep ciApplication={{}} />, { wrapper })

    expect(
      screen.queryByTestId('shared-comments-widget')
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('carbonIntensity:step5.noComments')
    ).toBeInTheDocument()
  })

  it('hides the decision panel for non-government users', () => {
    render(<GovernmentDecisionStep ciApplication={baseCi} />, { wrapper })
    expect(
      screen.queryByTestId('ci-step5-decision-panel')
    ).not.toBeInTheDocument()
  })

  it('shows the workflow panel for government users and completes verification 1', async () => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep ciApplication={baseCi} isGovernment={true} />,
      { wrapper }
    )
    expect(screen.getByTestId('ci-step5-decision-panel')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('ci-verification-1-complete-btn'))
    await waitFor(() =>
      expect(mockCompleteVerification1).toHaveBeenCalledWith({
        preliminaryRiskAssessment: 'Low',
        priorityScore: undefined
      })
    )
  })

  it.each([
    ['Analyst', roles.analyst],
    ['Manager', roles.compliance_manager],
    ['Director', roles.director]
  ])('shows Submitted action buttons to %s users', (_label, role) => {
    mockUserRoles = [{ name: role }]
    render(
      <GovernmentDecisionStep ciApplication={baseCi} isGovernment={true} />,
      { wrapper }
    )

    expect(
      screen.getByTestId('ci-verification-1-complete-btn')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('ci-request-documentation-btn')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('ci-request-pathway-changes-btn')
    ).toBeInTheDocument()
    expect(screen.getByTestId('ci-step5-withdraw-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('ci-approve-btn')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('ci-return-to-analyst-btn')
    ).not.toBeInTheDocument()
  })

  it('hides Recommend to director until generated fuel codes are complete', () => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep
        ciApplication={{
          ...baseCi,
          preliminaryRiskAssessment: 'Low',
          verification1Date: '2026-05-19T12:00:00Z'
        }}
        isGovernment={true}
      />,
      { wrapper }
    )

    expect(
      screen.queryByTestId('ci-recommend-to-director-btn')
    ).not.toBeInTheDocument()
  })

  it('shows Recommend to director after required generated fuel code fields are complete', () => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep
        ciApplication={{
          ...baseCi,
          preliminaryRiskAssessment: 'Low',
          verification1Date: '2026-05-19T12:00:00Z',
          generatedFuelCodes: [
            {
              id: 'generated-1',
              isValid: true
            }
          ]
        }}
        isGovernment={true}
      />,
      { wrapper }
    )

    expect(
      screen.getByTestId('ci-recommend-to-director-btn')
    ).toBeInTheDocument()
    expect(
      screen.getByText('carbonIntensity:step5.recommendToDirector')
    ).toBeInTheDocument()
  })

  it.each([
    ['Manager', roles.compliance_manager],
    ['Director', roles.director]
  ])('shows Recommend to director to %s users', (_label, role) => {
    mockUserRoles = [{ name: role }]
    render(
      <GovernmentDecisionStep
        ciApplication={{
          ...baseCi,
          preliminaryRiskAssessment: 'Low',
          verification1Date: '2026-05-19T12:00:00Z',
          generatedFuelCodes: [
            {
              id: 'generated-1',
              isValid: true
            }
          ]
        }}
        isGovernment={true}
      />,
      { wrapper }
    )

    expect(
      screen.getByTestId('ci-recommend-to-director-btn')
    ).toBeInTheDocument()
  })

  it('shows Generate fuel codes after Verification 1 for low risk', () => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep
        ciApplication={{
          ...baseCi,
          preliminaryRiskAssessment: 'Low',
          verification1Date: '2026-05-19T12:00:00Z'
        }}
        isGovernment={true}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('ci-generate-fuel-codes-btn')).toBeInTheDocument()
    expect(
      screen.getByText('carbonIntensity:step5.generateFuelCodes')
    ).toBeInTheDocument()
  })

  it('waits for Verification 2 before showing Generate fuel codes for moderate risk', () => {
    mockUserRoles = [{ name: roles.analyst }]
    const { rerender } = render(
      <GovernmentDecisionStep
        ciApplication={{
          ...baseCi,
          preliminaryRiskAssessment: 'Medium',
          verification1Date: '2026-05-19T12:00:00Z'
        }}
        isGovernment={true}
      />,
      { wrapper }
    )

    expect(
      screen.queryByTestId('ci-generate-fuel-codes-btn')
    ).not.toBeInTheDocument()

    rerender(
      <GovernmentDecisionStep
        ciApplication={{
          ...baseCi,
          preliminaryRiskAssessment: 'Medium',
          verification1Date: '2026-05-19T12:00:00Z',
          verification2Date: '2026-05-20T12:00:00Z',
          verification2RiskAssessment: 'Medium'
        }}
        isGovernment={true}
      />
    )

    expect(screen.getByTestId('ci-generate-fuel-codes-btn')).toBeInTheDocument()
  })

  it('waits for Verification 2 before showing Generate fuel codes for high risk', () => {
    mockUserRoles = [{ name: roles.analyst }]
    const { rerender } = render(
      <GovernmentDecisionStep
        ciApplication={{
          ...baseCi,
          preliminaryRiskAssessment: 'High',
          verification1Date: '2026-05-19T12:00:00Z'
        }}
        isGovernment={true}
      />,
      { wrapper }
    )

    expect(
      screen.queryByTestId('ci-generate-fuel-codes-btn')
    ).not.toBeInTheDocument()

    rerender(
      <GovernmentDecisionStep
        ciApplication={{
          ...baseCi,
          preliminaryRiskAssessment: 'High',
          verification1Date: '2026-05-19T12:00:00Z',
          verification2Date: '2026-05-20T12:00:00Z',
          verification2RiskAssessment: 'High'
        }}
        isGovernment={true}
      />
    )

    expect(screen.getByTestId('ci-generate-fuel-codes-btn')).toBeInTheDocument()
  })

  it('shows director actions and Set as withdrawn on Recommended applications', () => {
    mockUserRoles = [{ name: roles.director }]
    render(
      <GovernmentDecisionStep
        ciApplication={{ ...baseCi, status: { status: 'Recommended' } }}
        isGovernment={true}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('ci-approve-btn')).toBeInTheDocument()
    expect(screen.getByTestId('ci-return-to-analyst-btn')).toBeInTheDocument()
    expect(
      screen.queryByTestId('ci-request-documentation-btn')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('ci-request-pathway-changes-btn')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('ci-step5-withdraw-btn')).toBeInTheDocument()
  })

  it.each([
    ['Analyst', roles.analyst],
    ['Manager', roles.compliance_manager]
  ])('hides director decision actions from %s users', (_label, role) => {
    mockUserRoles = [{ name: role }]
    render(
      <GovernmentDecisionStep
        ciApplication={{ ...baseCi, status: { status: 'Recommended' } }}
        isGovernment={true}
      />,
      { wrapper }
    )

    expect(screen.queryByTestId('ci-approve-btn')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('ci-return-to-analyst-btn')
    ).not.toBeInTheDocument()
  })

  it('hides analyst verification and recommend controls after recommendation', () => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep
        ciApplication={{
          ...baseCi,
          status: { status: 'Recommended' },
          verification1Date: '2026-05-19T12:00:00Z',
          recommendationDate: '2026-05-20T12:00:00Z'
        }}
        isGovernment={true}
      />,
      { wrapper }
    )

    expect(
      screen.queryByTestId('ci-verification-1-complete-btn')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('ci-verification-2-complete-btn')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('ci-recommend-to-director-btn')
    ).not.toBeInTheDocument()
  })

  it('records Withdrawn without an inline comment payload', async () => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep ciApplication={baseCi} isGovernment={true} />,
      { wrapper }
    )
    fireEvent.click(screen.getByTestId('ci-step5-withdraw-btn'))
    await waitFor(() =>
      expect(mockRecordDecision).toHaveBeenCalledWith({ status: 'Withdrawn' })
    )
  })

  it('shows only Reactivate application workflow action when Withdrawn', async () => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep
        ciApplication={{ ...baseCi, status: { status: 'Withdrawn' } }}
        isGovernment={true}
        readOnly={true}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('ci-step5-reactivate-btn')).toBeInTheDocument()
    expect(
      screen.queryByTestId('ci-step5-withdraw-btn')
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('ci-approve-btn')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('ci-verification-1-complete-btn')
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('ci-step5-reactivate-btn'))
    await waitFor(() =>
      expect(mockRecordDecision).toHaveBeenCalledWith({ status: 'Submitted' })
    )
  })

  it('shows no Withdrawn or Reactivate action after approval', () => {
    mockUserRoles = [{ name: roles.director }]
    render(
      <GovernmentDecisionStep
        ciApplication={{ ...baseCi, status: { status: 'Completed' } }}
        isGovernment={true}
        readOnly={true}
      />,
      { wrapper }
    )

    expect(
      screen.queryByTestId('ci-step5-withdraw-btn')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('ci-step5-reactivate-btn')
    ).not.toBeInTheDocument()
  })

  it('requests supplemental pathway changes without recording a Draft decision', async () => {
    mockUserRoles = [{ name: roles.analyst }]
    const onSupplierRequest = vi.fn()
    render(
      <GovernmentDecisionStep
        ciApplication={baseCi}
        isGovernment={true}
        onSupplierRequest={onSupplierRequest}
      />,
      { wrapper }
    )
    fireEvent.click(screen.getByTestId('ci-request-pathway-changes-btn'))
    expect(screen.getByTestId('ci-request-pathway-changes-btn')).toBeDisabled()
    expect(
      screen.getByTestId('ci-request-documentation-btn')
    ).not.toBeDisabled()
    expect(onSupplierRequest).toHaveBeenCalledWith('pathwayChanges')
    await waitFor(() =>
      expect(mockRequestPathwayChanges).toHaveBeenCalledTimes(1)
    )
    expect(mockRecordDecision).not.toHaveBeenCalled()
  })

  it('keeps documentation and pathway request buttons active at the same time', () => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep ciApplication={baseCi} isGovernment={true} />,
      { wrapper }
    )
    expect(
      screen.getByTestId('ci-request-documentation-btn')
    ).not.toBeDisabled()
    expect(
      screen.getByTestId('ci-request-pathway-changes-btn')
    ).not.toBeDisabled()
  })

  it('disables only the clicked request button and records supplier wait start', async () => {
    mockUserRoles = [{ name: roles.analyst }]
    const onDocumentUploadClick = vi.fn()
    const onSupplierRequest = vi.fn()
    render(
      <GovernmentDecisionStep
        ciApplication={baseCi}
        isGovernment={true}
        onDocumentUploadClick={onDocumentUploadClick}
        onSupplierRequest={onSupplierRequest}
      />,
      { wrapper }
    )

    fireEvent.click(screen.getByTestId('ci-request-documentation-btn'))

    expect(screen.getByTestId('ci-request-documentation-btn')).toBeDisabled()
    expect(
      screen.getByTestId('ci-request-pathway-changes-btn')
    ).not.toBeDisabled()
    expect(onDocumentUploadClick).toHaveBeenCalled()
    expect(onSupplierRequest).toHaveBeenCalledWith('documentation')
  })

  it('can render only the decision panel for the submitted application page layout', () => {
    mockUserRoles = [{ name: roles.government }]
    render(
      <GovernmentDecisionStep
        ciApplication={baseCi}
        isGovernment={true}
        showComments={false}
        showTitle={false}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('ci-step5-decision-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('ci-step5-comments')).not.toBeInTheDocument()
    expect(
      screen.queryByText('carbonIntensity:step5.title')
    ).not.toBeInTheDocument()
  })

  it('can render only the comments section for the submitted application accordion', () => {
    mockUserRoles = [{ name: roles.government }]
    render(
      <GovernmentDecisionStep
        ciApplication={baseCi}
        isGovernment={true}
        showDecisionPanel={false}
        showCommentsTitle={false}
      />,
      { wrapper }
    )

    expect(
      screen.queryByTestId('ci-step5-decision-panel')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('ci-step5-comments')).toBeInTheDocument()
    expect(
      screen.queryByText('carbonIntensity:step5.commentsToOrganizationHeader')
    ).not.toBeInTheDocument()
  })
})
