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
    mockUserRoles = [{ name: roles.government }]
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

  it('records Withdrawn without an inline comment payload', async () => {
    mockUserRoles = [{ name: roles.government }]
    render(
      <GovernmentDecisionStep ciApplication={baseCi} isGovernment={true} />,
      { wrapper }
    )
    fireEvent.click(screen.getByTestId('ci-step5-withdraw-btn'))
    await waitFor(() =>
      expect(mockRecordDecision).toHaveBeenCalledWith({ status: 'Withdrawn' })
    )
  })

  it('disables the documentation request button when no upload handler is wired', () => {
    mockUserRoles = [{ name: roles.government }]
    render(
      <GovernmentDecisionStep ciApplication={baseCi} isGovernment={true} />,
      { wrapper }
    )
    expect(screen.getByTestId('ci-request-documentation-btn')).toBeDisabled()
  })

  it('enables the documentation request button when an upload handler is provided', () => {
    mockUserRoles = [{ name: roles.government }]
    render(
      <GovernmentDecisionStep
        ciApplication={baseCi}
        isGovernment={true}
        onDocumentUploadClick={() => {}}
      />,
      { wrapper }
    )
    expect(
      screen.getByTestId('ci-request-documentation-btn')
    ).not.toBeDisabled()
  })
})
