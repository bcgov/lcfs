import React from 'react'
import { cleanup, fireEvent, screen } from '@testing-library/react'

import { describe, expect, vi, beforeEach } from 'vitest'

import {
  DesignatedActionWorkflow,
  PLACEMENT_DECISION,
  PLACEMENT_EVIDENCE
} from '../DesignatedActionWorkflow'
import { test } from '@/tests/utils/fixtures'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

const mockPerform = vi.fn()
const mockSaveCredits = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useDesignatedActionWorkflow: () => ({
    mutate: mockPerform,
    isPending: false
  }),
  useSetRecommendedCredits: () => ({ mutate: mockSaveCredits })
}))

const analystActions = [
  'accept_evidence',
  'request_information',
  'recommend_to_manager',
  'not_recommend'
]

describe('DesignatedActionWorkflow', () => {
  beforeEach(() => vi.clearAllMocks())

  test('splits the actions by placement: evidence decisions and closing decisions', ({
    render,
    app
  }) => {
    // The API offers everything an analyst may do; each placement shows
    // only its share (#5080), and together they show all of it.
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory
        placement={PLACEMENT_EVIDENCE}
      />,
      app
    )
    expect(screen.getByTestId('workflow-accept_evidence')).toBeInTheDocument()
    expect(
      screen.getByTestId('workflow-request_information')
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('workflow-recommend_to_manager')
    ).not.toBeInTheDocument()
    cleanup()

    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory
        placement={PLACEMENT_DECISION}
      />,
      app
    )
    expect(
      screen.getByTestId('workflow-recommend_to_manager')
    ).toBeInTheDocument()
    // The wireframe's negative recommendation sits beside it (#5118).
    expect(screen.getByTestId('workflow-not_recommend')).toBeInTheDocument()
    expect(
      screen.queryByTestId('workflow-accept_evidence')
    ).not.toBeInTheDocument()
  })

  test('renders nothing for a placement with no actions to offer', ({
    render,
    app
  }) => {
    // A director has no evidence decisions; the evidence slot stays
    // empty rather than showing an empty block.
    const { container } = render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={['approve', 'reject', 'return']}
        allEvidenceSatisfactory
        placement={PLACEMENT_EVIDENCE}
      />,
      app
    )
    expect(container).toBeEmptyDOMElement()
  })

  test('shows only the actions the API says are available', ({
    render,
    app
  }) => {
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={['approve', 'reject', 'return']}
        allEvidenceSatisfactory
      />,
      app
    )

    expect(screen.getByTestId('workflow-approve')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-reject')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-return')).toBeInTheDocument()
    expect(
      screen.queryByTestId('workflow-recommend_to_manager')
    ).not.toBeInTheDocument()
  })

  test('disables accept and recommend until every requirement is satisfactory', ({
    render,
    app
  }) => {
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory={false}
        missingInformation="The signed permit."
      />,
      app
    )

    expect(screen.getByTestId('workflow-accept_evidence')).toBeDisabled()
    expect(screen.getByTestId('workflow-recommend_to_manager')).toBeDisabled()
    // Requesting information, or not recommending, is exactly what you do
    // when it is not.
    expect(
      screen.getByTestId('workflow-request_information')
    ).not.toBeDisabled()
    expect(screen.getByTestId('workflow-not_recommend')).not.toBeDisabled()
  })

  test('accepts the evidence without asking for anything else', ({
    render,
    app
  }) => {
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory
      />,
      app
    )

    fireEvent.click(screen.getByTestId('workflow-accept_evidence'))

    expect(mockPerform).toHaveBeenCalledWith(
      { action: 'accept_evidence' },
      expect.anything()
    )
  })

  test('sends the Missing information box when requesting information', ({
    render,
    app
  }) => {
    // The reason is on the page (#5118); there is nothing more to ask.
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory
        missingInformation="  Send the signed permit.  "
      />,
      app
    )

    fireEvent.click(screen.getByTestId('workflow-request_information'))

    expect(screen.queryByTestId('workflow-comment')).not.toBeInTheDocument()
    expect(mockPerform).toHaveBeenCalledWith(
      { action: 'request_information', comment: 'Send the signed permit.' },
      expect.anything()
    )
  })

  test('cannot request information until the box says what is missing', ({
    render,
    app
  }) => {
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory
        missingInformation="   "
      />,
      app
    )

    expect(screen.getByTestId('workflow-request_information')).toBeDisabled()
    expect(
      screen.getByTestId('workflow-tip-request_information')
    ).toHaveAttribute(
      'aria-label',
      expect.stringContaining('blockedNoMissingInformation')
    )
  })

  test('asks why before not recommending', ({ render, app }) => {
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory={false}
        placement={PLACEMENT_DECISION}
      />,
      app
    )

    fireEvent.click(screen.getByTestId('workflow-not_recommend'))
    expect(mockPerform).not.toHaveBeenCalled()
    expect(
      screen.getByText('initiativeAgreement:workflow.prompt.not_recommend')
    ).toBeInTheDocument()

    fireEvent.change(screen.getByTestId('workflow-comment'), {
      target: { value: 'The permit was never issued.' }
    })
    fireEvent.click(screen.getByText('initiativeAgreement:workflow.submit'))

    expect(mockPerform).toHaveBeenCalledWith(
      { action: 'not_recommend', comment: 'The permit was never issued.' },
      expect.anything()
    )
  })

  test('sends the saved recommended amount when recommending', ({
    render,
    app
  }) => {
    // The amount is edited in the page header (#5079); the action carries
    // whatever was saved there.
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory
        recommendedCredits={1200}
      />,
      app
    )

    fireEvent.click(screen.getByTestId('workflow-recommend_to_manager'))

    expect(mockPerform).toHaveBeenCalledWith(
      { action: 'recommend_to_manager', recommendedCredits: 1200 },
      expect.anything()
    )
  })

  test('no longer hosts the credits field', ({ render, app }) => {
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory
        recommendedCredits={null}
      />,
      app
    )

    expect(
      screen.queryByTestId('recommended-credits-input')
    ).not.toBeInTheDocument()
  })

  test('a disabled button says what would enable it', ({ render, app }) => {
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory={false}
        hasRequirements
      />,
      app
    )

    expect(screen.getByTestId('workflow-tip-accept_evidence')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('blockedByEvidence')
    )
  })

  test('tells you to add a requirement when there are none', ({
    render,
    app
  }) => {
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory={false}
        hasRequirements={false}
      />,
      app
    )

    expect(screen.getByTestId('workflow-tip-accept_evidence')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('blockedNoRequirements')
    )
  })

  test('surfaces the reason the API refused an action', ({ render, app }) => {
    mockPerform.mockImplementation((_payload, handlers) =>
      handlers.onError({
        response: {
          data: { detail: 'A recommended credit amount is required.' }
        }
      })
    )
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory
      />,
      app
    )

    fireEvent.click(screen.getByTestId('workflow-accept_evidence'))

    expect(screen.getByTestId('workflow-error')).toHaveTextContent(
      'A recommended credit amount is required.'
    )
  })

  test('tells the caller when something changed', ({ render, app }) => {
    const onChanged = vi.fn()
    mockPerform.mockImplementation((_payload, handlers) => handlers.onSuccess())
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory
        onChanged={onChanged}
      />,
      app
    )

    fireEvent.click(screen.getByTestId('workflow-accept_evidence'))

    expect(onChanged).toHaveBeenCalled()
  })
})
