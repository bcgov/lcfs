import React from 'react'
import { afterEach, beforeEach, describe, expect, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within
} from '@testing-library/react'

import { roles } from '@/constants/roles'
import { test } from '@/tests/utils/fixtures'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

const mockRecordDecision = vi.fn().mockResolvedValue(null)
const mockCompleteVerification1 = vi.fn().mockResolvedValue(null)
const mockCompleteVerification2 = vi.fn().mockResolvedValue(null)
const mockRecommendToDirector = vi.fn().mockResolvedValue(null)
const mockRequestPathwayChanges = vi.fn().mockResolvedValue(null)
const mockRequestDocumentation = vi.fn().mockResolvedValue(null)
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
  useRequestCIApplicationDocumentation: vi.fn(() => ({
    mutateAsync: mockRequestDocumentation,
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

  test('renders the shared Comments widget targeting this CI application', ({
    render,
    theme,
    router
  }) => {
    render(<GovernmentDecisionStep ciApplication={baseCi} />, [theme, router])

    const widget = screen.getByTestId('shared-comments-widget')
    expect(widget).toBeInTheDocument()
    expect(widget).toHaveAttribute('data-entity-type', 'ciApplication')
    expect(widget).toHaveAttribute('data-entity-id', '10')
    expect(widget).toHaveAttribute('data-comment-mode', 'dual')
  })

  test('renders the empty-thread placeholder when there is no application id', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<GovernmentDecisionStep ciApplication={{}} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(
      screen.queryByTestId('shared-comments-widget')
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('carbonIntensity:step5.noComments')
    ).toBeInTheDocument()
  })

  test('hides the decision panel for non-government users', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<GovernmentDecisionStep ciApplication={baseCi} />, [
      query,
      theme,
      localization,
      router
    ])
    expect(
      screen.queryByTestId('ci-step5-decision-panel')
    ).not.toBeInTheDocument()
  })

  test('shows the workflow panel for government users and completes verification 1', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep ciApplication={baseCi} isGovernment={true} />,
      [query, theme, localization, router]
    )
    expect(screen.getByTestId('ci-step5-decision-panel')).toBeInTheDocument()
    fireEvent.change(screen.getByTestId('ci-priority-score-input'), {
      target: { value: '120' }
    })
    fireEvent.click(screen.getByTestId('ci-verification-1-complete-btn'))
    await waitFor(() =>
      expect(mockCompleteVerification1).toHaveBeenCalledWith({
        preliminaryRiskAssessment: 'Low',
        priorityScore: 120
      })
    )
  })

  test('requires a valid priority score before completing verification 1', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep ciApplication={baseCi} isGovernment={true} />,
      [query, theme, localization, router]
    )

    fireEvent.click(screen.getByTestId('ci-verification-1-complete-btn'))

    expect(mockCompleteVerification1).not.toHaveBeenCalled()
    expect(
      screen.getAllByText('carbonIntensity:step5.priorityScoreInvalid').length
    ).toBeGreaterThan(0)
  })

  test('allows a blank priority score before a verification action is submitted', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep ciApplication={baseCi} isGovernment={true} />,
      [query, theme, localization, router]
    )

    fireEvent.blur(screen.getByTestId('ci-priority-score-input'))

    expect(
      screen.queryByText('carbonIntensity:step5.priorityScoreInvalid')
    ).not.toBeInTheDocument()
  })

  test('caps priority score at 999 and ignores decimal input', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep ciApplication={baseCi} isGovernment={true} />,
      [query, theme, localization, router]
    )
    const input = screen.getByTestId('ci-priority-score-input')

    fireEvent.change(input, { target: { value: '1000' } })
    expect(input).toHaveValue('999')

    fireEvent.change(input, { target: { value: '12.5' } })
    expect(input).toHaveValue('999')
  })

  for (const [_label, role] of [
    ['Analyst', roles.analyst],
    ['Manager', roles.compliance_manager],
    ['Director', roles.director]
  ]) {
    test(`shows Submitted action buttons to ${_label} users`, ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      mockUserRoles = [{ name: role }]
      render(
        <GovernmentDecisionStep ciApplication={baseCi} isGovernment={true} />,
        [query, theme, localization, router]
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
  }

  test('hides Recommend to director until generated fuel codes are complete', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
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
      [query, theme, localization, router]
    )

    expect(
      screen.queryByTestId('ci-recommend-to-director-btn')
    ).not.toBeInTheDocument()
  })

  test('shows Recommend to director after required generated fuel code fields are complete', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
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
      [query, theme, localization, router]
    )

    expect(
      screen.getByTestId('ci-recommend-to-director-btn')
    ).toBeInTheDocument()
    expect(
      screen.getByText('carbonIntensity:step5.recommendToDirector')
    ).toBeInTheDocument()
  })

  for (const [_label, role] of [
    ['Manager', roles.compliance_manager],
    ['Director', roles.director]
  ]) {
    test(`shows Recommend to director to ${_label} users`, ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
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
        [query, theme, localization, router]
      )

      expect(
        screen.getByTestId('ci-recommend-to-director-btn')
      ).toBeInTheDocument()
    })
  }

  test('shows Generate fuel codes after Verification 1 for low risk', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
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
      [query, theme, localization, router]
    )

    expect(screen.getByTestId('ci-generate-fuel-codes-btn')).toBeInTheDocument()
    expect(
      screen.getByText('carbonIntensity:step5.generateFuelCodes')
    ).toBeInTheDocument()
  })

  // #4741 — Medium risk keeps the Verification 2 workflow (and therefore the
  // Risk Assessment / Priority Score fields) after Verification 1 completes.
  test('keeps Verification 2 available after Verification 1 for moderate risk', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep
        ciApplication={{
          ...baseCi,
          preliminaryRiskAssessment: 'Medium',
          verification1Date: '2026-05-19T12:00:00Z'
        }}
        isGovernment={true}
      />,
      [query, theme, localization, router]
    )

    expect(
      screen.getByTestId('ci-verification-2-complete-btn')
    ).toBeInTheDocument()
    expect(
      screen.getByText('carbonIntensity:step5.verification2Complete')
    ).toBeInTheDocument()
  })

  test('keeps Risk Assessment and Priority Score visible for moderate risk after Verification 1', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep
        ciApplication={{
          ...baseCi,
          preliminaryRiskAssessment: 'Medium',
          verification1Date: '2026-05-19T12:00:00Z'
        }}
        isGovernment={true}
      />,
      [query, theme, localization, router]
    )

    expect(
      screen.getByText('carbonIntensity:step5.riskAssessment:')
    ).toBeInTheDocument()
    expect(screen.getByTestId('ci-priority-score-input')).toBeInTheDocument()
  })

  test('withholds Generate fuel codes for moderate risk until Verification 2 is complete', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
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
      [query, theme, localization, router]
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

  test('does not show Generate fuel codes before Verification 1 is complete', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep
        ciApplication={{
          ...baseCi,
          preliminaryRiskAssessment: 'Medium'
        }}
        isGovernment={true}
      />,
      [query, theme, localization, router]
    )

    expect(
      screen.queryByTestId('ci-generate-fuel-codes-btn')
    ).not.toBeInTheDocument()
  })

  test('shows Generate fuel codes when switched from high to moderate risk on Verification 2', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
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
      [query, theme, localization, router]
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
          verification2RiskAssessment: 'Medium'
        }}
        isGovernment={true}
      />
    )

    expect(screen.getByTestId('ci-generate-fuel-codes-btn')).toBeInTheDocument()
  })

  test('waits for Verification 2 before showing Generate fuel codes for high risk', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
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
      [query, theme, localization, router]
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

  test('shows director actions and Set as withdrawn on Recommended applications', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.director }]
    render(
      <GovernmentDecisionStep
        ciApplication={{ ...baseCi, status: { status: 'Recommended' } }}
        isGovernment={true}
      />,
      [query, theme, localization, router]
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

  for (const [_label, role] of [
    ['Analyst', roles.analyst],
    ['Manager', roles.compliance_manager]
  ]) {
    test(`hides director decision actions from ${_label} users`, ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      mockUserRoles = [{ name: role }]
      render(
        <GovernmentDecisionStep
          ciApplication={{ ...baseCi, status: { status: 'Recommended' } }}
          isGovernment={true}
        />,
        [query, theme, localization, router]
      )

      expect(screen.queryByTestId('ci-approve-btn')).not.toBeInTheDocument()
      expect(
        screen.queryByTestId('ci-return-to-analyst-btn')
      ).not.toBeInTheDocument()
    })
  }

  test('hides analyst verification and recommend controls after recommendation', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
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
      [query, theme, localization, router]
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

  test('records Withdrawn without an inline comment payload', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep ciApplication={baseCi} isGovernment={true} />,
      [query, theme, localization, router]
    )
    fireEvent.click(screen.getByTestId('ci-step5-withdraw-btn'))
    await waitFor(() =>
      expect(mockRecordDecision).toHaveBeenCalledWith({ status: 'Withdrawn' })
    )
  })

  test('shows only Reactivate application workflow action when Withdrawn', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep
        ciApplication={{ ...baseCi, status: { status: 'Withdrawn' } }}
        isGovernment={true}
        readOnly={true}
      />,
      [query, theme, localization, router]
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

  test('shows no Withdrawn or Reactivate action after approval', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.director }]
    render(
      <GovernmentDecisionStep
        ciApplication={{ ...baseCi, status: { status: 'Completed' } }}
        isGovernment={true}
        readOnly={true}
      />,
      [query, theme, localization, router]
    )

    expect(
      screen.queryByTestId('ci-step5-withdraw-btn')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('ci-step5-reactivate-btn')
    ).not.toBeInTheDocument()
  })

  test('requests supplemental pathway changes without recording a Draft decision', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.analyst }]
    const onSupplierRequest = vi.fn()
    render(
      <GovernmentDecisionStep
        ciApplication={baseCi}
        isGovernment={true}
        onSupplierRequest={onSupplierRequest}
      />,
      [query, theme, localization, router]
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

  test('keeps documentation and pathway request buttons active at the same time', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep ciApplication={baseCi} isGovernment={true} />,
      [query, theme, localization, router]
    )
    expect(
      screen.getByTestId('ci-request-documentation-btn')
    ).not.toBeDisabled()
    expect(
      screen.getByTestId('ci-request-pathway-changes-btn')
    ).not.toBeDisabled()
  })

  test('opens a confirmation on click without firing the request or disabling the button (#4651)', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep
        ciApplication={baseCi}
        isGovernment={true}
        onSupplierRequest={vi.fn()}
      />,
      [query, theme, localization, router]
    )

    fireEvent.click(screen.getByTestId('ci-request-documentation-btn'))

    expect(screen.getByTestId('modal')).toBeInTheDocument()
    expect(mockRequestDocumentation).not.toHaveBeenCalled()
    expect(
      screen.getByTestId('ci-request-documentation-btn')
    ).not.toBeDisabled()
  })

  test('leaves the button enabled after cancelling the confirmation (#4651)', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.analyst }]
    render(
      <GovernmentDecisionStep
        ciApplication={baseCi}
        isGovernment={true}
        onSupplierRequest={vi.fn()}
      />,
      [query, theme, localization, router]
    )

    fireEvent.click(screen.getByTestId('ci-request-documentation-btn'))
    const modal = screen.getByTestId('modal')
    fireEvent.click(within(modal).getByText('common:cancelBtn'))

    expect(mockRequestDocumentation).not.toHaveBeenCalled()
    expect(
      screen.getByTestId('ci-request-documentation-btn')
    ).not.toBeDisabled()
  })

  test('requests documentation and disables the button after confirming (#4644)', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.analyst }]
    const onSupplierRequest = vi.fn()
    render(
      <GovernmentDecisionStep
        ciApplication={baseCi}
        isGovernment={true}
        onSupplierRequest={onSupplierRequest}
      />,
      [query, theme, localization, router]
    )

    fireEvent.click(screen.getByTestId('ci-request-documentation-btn'))
    const modal = screen.getByTestId('modal')
    fireEvent.click(
      within(modal).getByText('carbonIntensity:step5.requestDocumentation')
    )

    await waitFor(() =>
      expect(mockRequestDocumentation).toHaveBeenCalledTimes(1)
    )
    expect(onSupplierRequest).toHaveBeenCalledWith('documentation')
    expect(screen.getByTestId('ci-request-documentation-btn')).toBeDisabled()
  })

  test('can render only the decision panel for the submitted application page layout', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.government }]
    render(
      <GovernmentDecisionStep
        ciApplication={baseCi}
        isGovernment={true}
        showComments={false}
        showTitle={false}
      />,
      [query, theme, localization, router]
    )

    expect(screen.getByTestId('ci-step5-decision-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('ci-step5-comments')).not.toBeInTheDocument()
    expect(
      screen.queryByText('carbonIntensity:step5.title')
    ).not.toBeInTheDocument()
  })

  test('can render only the comments section for the submitted application accordion', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = [{ name: roles.government }]
    render(
      <GovernmentDecisionStep
        ciApplication={baseCi}
        isGovernment={true}
        showDecisionPanel={false}
        showCommentsTitle={false}
      />,
      [query, theme, localization, router]
    )

    expect(
      screen.queryByTestId('ci-step5-decision-panel')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('ci-step5-comments')).toBeInTheDocument()
    expect(
      screen.queryByText('carbonIntensity:step5.commentsToOrganizationHeader')
    ).not.toBeInTheDocument()
  })

  // #4797 — the risk assessment and priority score used to vanish from the
  // application once the last verification panel closed.
  describe('post-verification read-only summary', () => {
    const verifiedCi = {
      ...baseCi,
      preliminaryRiskAssessment: 'Medium',
      priorityScore: 42,
      verification1Date: '2026-05-19T12:00:00Z',
      verification2Date: '2026-05-20T12:00:00Z',
      verification2RiskAssessment: 'High',
      verification2PriorityScore: 77
    }

    it('shows the Verification 2 risk assessment and priority score as text', () => {
      mockUserRoles = [{ name: roles.analyst }]
      render(
        <GovernmentDecisionStep
          ciApplication={verifiedCi}
          isGovernment={true}
        />,
        { wrapper }
      )

      const summary = screen.getByTestId('ci-verification-summary')
      expect(within(summary).getByText('Verification 2')).toBeInTheDocument()
      expect(
        screen.getByTestId('ci-verification-summary-risk')
      ).toHaveTextContent('High')
      expect(
        screen.getByTestId('ci-verification-summary-priority-score')
      ).toHaveTextContent('77')
      expect(
        screen.queryByTestId('ci-priority-score-input')
      ).not.toBeInTheDocument()
    })

    it('keeps the values visible once fuel codes are generated', () => {
      mockUserRoles = [{ name: roles.analyst }]
      render(
        <GovernmentDecisionStep
          ciApplication={{
            ...verifiedCi,
            generatedFuelCodes: [{ isValid: true }]
          }}
          isGovernment={true}
        />,
        { wrapper }
      )

      expect(
        screen.getByTestId('ci-verification-summary-priority-score')
      ).toHaveTextContent('77')
    })

    it('keeps the values visible after recommendation and approval', () => {
      mockUserRoles = [{ name: roles.director }]
      const { rerender } = render(
        <GovernmentDecisionStep
          ciApplication={{
            ...verifiedCi,
            status: { status: 'Recommended' },
            recommendationDate: '2026-05-21T12:00:00Z'
          }}
          isGovernment={true}
        />,
        { wrapper }
      )

      expect(
        screen.getByTestId('ci-verification-summary-risk')
      ).toHaveTextContent('High')

      rerender(
        <GovernmentDecisionStep
          ciApplication={{
            ...verifiedCi,
            status: { status: 'Completed' },
            recommendationDate: '2026-05-21T12:00:00Z',
            approvalDate: '2026-05-22T12:00:00Z'
          }}
          isGovernment={true}
          readOnly={true}
        />
      )

      expect(
        screen.getByTestId('ci-verification-summary-risk')
      ).toHaveTextContent('High')
    })

    it('falls back to the Verification 1 values for low risk applications', () => {
      mockUserRoles = [{ name: roles.analyst }]
      render(
        <GovernmentDecisionStep
          ciApplication={{
            ...baseCi,
            preliminaryRiskAssessment: 'Low',
            priorityScore: 12,
            verification1Date: '2026-05-19T12:00:00Z'
          }}
          isGovernment={true}
        />,
        { wrapper }
      )

      const summary = screen.getByTestId('ci-verification-summary')
      expect(within(summary).getByText('Verification 1')).toBeInTheDocument()
      expect(
        screen.getByTestId('ci-verification-summary-risk')
      ).toHaveTextContent('Low')
      expect(
        screen.getByTestId('ci-verification-summary-priority-score')
      ).toHaveTextContent('12')
    })

    it('labels a Medium risk assessment as Moderate', () => {
      mockUserRoles = [{ name: roles.analyst }]
      render(
        <GovernmentDecisionStep
          ciApplication={{
            ...verifiedCi,
            verification2RiskAssessment: 'Medium'
          }}
          isGovernment={true}
        />,
        { wrapper }
      )

      expect(
        screen.getByTestId('ci-verification-summary-risk')
      ).toHaveTextContent('Moderate')
    })

    it('is visible to read-only IDIR users', () => {
      mockUserRoles = [{ name: roles.government }]
      render(
        <GovernmentDecisionStep
          ciApplication={verifiedCi}
          isGovernment={true}
        />,
        { wrapper }
      )

      expect(
        screen.getByTestId('ci-verification-summary-priority-score')
      ).toHaveTextContent('77')
    })

    it('is hidden from BCeID users', () => {
      mockUserRoles = [{ name: roles.ci_applicant }]
      render(
        <GovernmentDecisionStep
          ciApplication={verifiedCi}
          isGovernment={false}
        />,
        { wrapper }
      )

      expect(
        screen.queryByTestId('ci-verification-summary')
      ).not.toBeInTheDocument()
    })

    it('is hidden while a verification panel is still editable', () => {
      mockUserRoles = [{ name: roles.analyst }]
      render(
        <GovernmentDecisionStep
          ciApplication={{
            ...baseCi,
            preliminaryRiskAssessment: 'Medium',
            priorityScore: 42,
            verification1Date: '2026-05-19T12:00:00Z'
          }}
          isGovernment={true}
        />,
        { wrapper }
      )

      expect(
        screen.queryByTestId('ci-verification-summary')
      ).not.toBeInTheDocument()
      expect(screen.getByTestId('ci-priority-score-input')).toBeInTheDocument()
    })

    it('is hidden before any verification is complete', () => {
      mockUserRoles = [{ name: roles.analyst }]
      render(
        <GovernmentDecisionStep ciApplication={baseCi} isGovernment={true} />,
        { wrapper }
      )

      expect(
        screen.queryByTestId('ci-verification-summary')
      ).not.toBeInTheDocument()
    })

    it('renders the values as a description list for assistive technology', () => {
      mockUserRoles = [{ name: roles.analyst }]
      render(
        <GovernmentDecisionStep
          ciApplication={verifiedCi}
          isGovernment={true}
        />,
        { wrapper }
      )

      const value = screen.getByTestId('ci-verification-summary-priority-score')
      expect(value.tagName).toBe('DD')
      expect(value.closest('dl')).not.toBeNull()
    })
  })
})
