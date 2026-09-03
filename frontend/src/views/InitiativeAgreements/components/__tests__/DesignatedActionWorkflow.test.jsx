import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { DesignatedActionWorkflow } from '../DesignatedActionWorkflow'
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

  it('sends the recommended amount when recommending', () => {
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory
        canEditCredits
        recommendedCredits={null}
        creditAllocation={1850}
      />,
      { wrapper }
    )

    fireEvent.change(screen.getByTestId('recommended-credits-input'), {
      target: { value: '1200' }
    })
    fireEvent.click(screen.getByTestId('workflow-recommend_to_manager'))

    expect(mockPerform).toHaveBeenCalledWith(
      { action: 'recommend_to_manager', recommendedCredits: 1200 },
      expect.anything()
    )
  })

  it('saves an edited amount when the field loses focus', () => {
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={analystActions}
        allEvidenceSatisfactory
        canEditCredits
        recommendedCredits={null}
        creditAllocation={1850}
      />,
      { wrapper }
    )

    const input = screen.getByTestId('recommended-credits-input')
    fireEvent.change(input, { target: { value: '900' } })
    fireEvent.blur(input)

    expect(mockSaveCredits).toHaveBeenCalledWith(900)
  })

  it('does not offer the credits field to a director', () => {
    render(
      <DesignatedActionWorkflow
        designatedActionId="9"
        availableActions={['approve', 'reject', 'return']}
        allEvidenceSatisfactory
        canEditCredits={false}
        recommendedCredits={1200}
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
