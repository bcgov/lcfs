import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  DesignatedActionWorkflow,
  PLACEMENT_DECISION,
  PLACEMENT_EVIDENCE
} from '../DesignatedActionWorkflow'
import { wrapper } from '@/tests/utils/wrapper'

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
  'recommend_to_manager'
]

describe('DesignatedActionWorkflow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('splits the actions by placement: evidence decisions and closing decisions', () => {
    // The API offers everything an analyst may do; each placement shows
    // only its share (#5080), and together they show all of it.
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory
        placement={PLACEMENT_EVIDENCE}
      />,
      { wrapper }
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
      { wrapper }
    )
    expect(
      screen.getByTestId('workflow-recommend_to_manager')
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('workflow-accept_evidence')
    ).not.toBeInTheDocument()
  })

  it('renders nothing for a placement with no actions to offer', () => {
    // A director has no evidence decisions; the evidence slot stays
    // empty rather than showing an empty block.
    const { container } = render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={['approve', 'reject', 'return']}
        allEvidenceSatisfactory
        placement={PLACEMENT_EVIDENCE}
      />,
      { wrapper }
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows only the actions the API says are available', () => {
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={['approve', 'reject', 'return']}
        allEvidenceSatisfactory
      />,
      { wrapper }
    )

    expect(screen.getByTestId('workflow-approve')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-reject')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-return')).toBeInTheDocument()
    expect(
      screen.queryByTestId('workflow-recommend_to_manager')
    ).not.toBeInTheDocument()
  })

  it('disables accept and recommend until every requirement is satisfactory', () => {
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory={false}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('workflow-accept_evidence')).toBeDisabled()
    expect(screen.getByTestId('workflow-recommend_to_manager')).toBeDisabled()
    // Requesting information is exactly what you do when it is not.
    expect(
      screen.getByTestId('workflow-request_information')
    ).not.toBeDisabled()
  })

  it('accepts the evidence without asking for anything else', () => {
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory
      />,
      { wrapper }
    )

    fireEvent.click(screen.getByTestId('workflow-accept_evidence'))

    expect(mockPerform).toHaveBeenCalledWith(
      { action: 'accept_evidence' },
      expect.anything()
    )
  })

  it('asks what is needed before requesting information', () => {
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory
      />,
      { wrapper }
    )

    fireEvent.click(screen.getByTestId('workflow-request_information'))
    expect(mockPerform).not.toHaveBeenCalled()

    const box = screen.getByTestId('workflow-comment')
    fireEvent.change(box, { target: { value: 'Send the signed permit.' } })
    fireEvent.click(screen.getByText('initiativeAgreement:workflow.submit'))

    expect(mockPerform).toHaveBeenCalledWith(
      { action: 'request_information', comment: 'Send the signed permit.' },
      expect.anything()
    )
  })

  it('sends the saved recommended amount when recommending', () => {
    // The amount is edited in the page header (#5079); the action carries
    // whatever was saved there.
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory
        recommendedCredits={1200}
      />,
      { wrapper }
    )

    fireEvent.click(screen.getByTestId('workflow-recommend_to_manager'))

    expect(mockPerform).toHaveBeenCalledWith(
      { action: 'recommend_to_manager', recommendedCredits: 1200 },
      expect.anything()
    )
  })

  it('no longer hosts the credits field', () => {
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory
        recommendedCredits={null}
      />,
      { wrapper }
    )

    expect(
      screen.queryByTestId('recommended-credits-input')
    ).not.toBeInTheDocument()
  })

  it('a disabled button says what would enable it', () => {
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory={false}
        hasRequirements
      />,
      { wrapper }
    )

    expect(screen.getByTestId('workflow-tip-accept_evidence')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('blockedByEvidence')
    )
  })

  it('tells you to add a requirement when there are none', () => {
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory={false}
        hasRequirements={false}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('workflow-tip-accept_evidence')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('blockedNoRequirements')
    )
  })

  it('surfaces the reason the API refused an action', () => {
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
      { wrapper }
    )

    fireEvent.click(screen.getByTestId('workflow-accept_evidence'))

    expect(screen.getByTestId('workflow-error')).toHaveTextContent(
      'A recommended credit amount is required.'
    )
  })

  it('tells the caller when something changed', () => {
    const onChanged = vi.fn()
    mockPerform.mockImplementation((_payload, handlers) => handlers.onSuccess())
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory
        onChanged={onChanged}
      />,
      { wrapper }
    )

    fireEvent.click(screen.getByTestId('workflow-accept_evidence'))

    expect(onChanged).toHaveBeenCalled()
  })
})
