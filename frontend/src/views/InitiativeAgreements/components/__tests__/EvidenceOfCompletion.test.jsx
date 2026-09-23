import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  EvidenceOfCompletion,
  OUTCOME_INFORMATION_REQUESTED,
  OUTCOME_SATISFACTORY
} from '../EvidenceOfCompletion'
import { roles } from '@/constants/roles'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

let mockRoles = [roles.ia_analyst]
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { roles: mockRoles.map((name) => ({ name })) },
    hasRoles: (...names) => names.some((n) => mockRoles.includes(n)),
    hasAnyRole: (...names) => names.some((n) => mockRoles.includes(n))
  })
}))

const mockList = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockRemove = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useEvidenceRequirements: () => mockList(),
  useCreateEvidenceRequirement: () => ({
    mutate: mockCreate,
    isPending: false
  }),
  useUpdateEvidenceRequirement: () => ({ mutate: mockUpdate }),
  useDeleteEvidenceRequirement: () => ({ mutate: mockRemove })
}))

const requirement = (overrides = {}) => ({
  evidenceRequirementId: 1,
  designatedActionId: 9,
  requirementNumber: 1,
  title: 'Permits',
  description: 'List of major permits and approvals',
  isActive: true,
  analystReview: '',
  reviewOutcome: null,
  reviewNotes: null,
  reviewedBy: null,
  reviewedDate: null,
  ...overrides
})

describe('EvidenceOfCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoles = [roles.ia_analyst]
    mockList.mockReturnValue({ data: [requirement()], isLoading: false })
  })

  it('renders a requirement card and the review summary', () => {
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    // The title appears twice on purpose: once as the card's heading,
    // once in the review summary, matching the wireframe. The description
    // is the card's body.
    expect(screen.getByTestId('eoc-heading-1')).toHaveTextContent('Permits')
    expect(screen.getByTestId('eoc-description-1')).toHaveValue(
      'List of major permits and approvals'
    )
    expect(screen.getByTestId('eoc-review-summary')).toHaveTextContent(
      'Permits'
    )
  })

  it('records a satisfactory assessment', () => {
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    fireEvent.click(
      screen.getByTestId('eoc-satisfactory-1').querySelector('input')
    )

    expect(mockUpdate).toHaveBeenCalledWith({
      evidenceRequirementId: 1,
      reviewOutcome: OUTCOME_SATISFACTORY
    })
  })

  it('records a request for information', () => {
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    fireEvent.click(screen.getByTestId('eoc-request-1').querySelector('input'))

    expect(mockUpdate).toHaveBeenCalledWith({
      evidenceRequirementId: 1,
      reviewOutcome: OUTCOME_INFORMATION_REQUESTED
    })
  })

  it('clicking the ticked outcome returns it to unreviewed', () => {
    mockList.mockReturnValue({
      data: [requirement({ reviewOutcome: OUTCOME_SATISFACTORY })],
      isLoading: false
    })
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    fireEvent.click(
      screen.getByTestId('eoc-satisfactory-1').querySelector('input')
    )

    expect(mockUpdate).toHaveBeenCalledWith({
      evidenceRequirementId: 1,
      clearReviewOutcome: true
    })
  })

  it('the two outcomes are mutually exclusive', () => {
    mockList.mockReturnValue({
      data: [requirement({ reviewOutcome: OUTCOME_SATISFACTORY })],
      isLoading: false
    })
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    expect(
      screen.getByTestId('eoc-satisfactory-1').querySelector('input')
    ).toBeChecked()
    expect(
      screen.getByTestId('eoc-request-1').querySelector('input')
    ).not.toBeChecked()
  })

  it('shows the number and title as the heading, with the evaluation always present', () => {
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    expect(screen.getByTestId('eoc-heading-1')).toHaveTextContent('1. Permits')
    expect(screen.getByTestId('eoc-review-1')).toBeInTheDocument()
    // Outside edit mode the text is read-only, not editable in place.
    expect(screen.getByTestId('eoc-review-1')).toHaveAttribute('readonly')
  })

  it('falls back to the description as the heading when there is no title', () => {
    mockList.mockReturnValue({
      data: [requirement({ title: null })],
      isLoading: false
    })
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    expect(screen.getByTestId('eoc-heading-1')).toHaveTextContent(
      '1. List of major permits and approvals'
    )
  })

  it('hides the edit control by default, leaving the text read-only', () => {
    // The pencil beside the remove icon read as two unlabelled controls,
    // so its entry point is off until the control is redesigned. The
    // machinery stays: the tests below turn it on.
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    expect(screen.queryByTestId('eoc-edit-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('eoc-review-1')).toHaveAttribute('readonly')
    expect(screen.getByTestId('eoc-remove-1')).toBeInTheDocument()
  })

  it('writes nothing until Save, then only what changed', () => {
    render(<EvidenceOfCompletion designatedActionId="9" allowEdit />, {
      wrapper
    })

    fireEvent.click(screen.getByTestId('eoc-edit-1'))
    fireEvent.change(screen.getByTestId('eoc-review-1'), {
      target: { value: 'Permits verified.' }
    })
    fireEvent.change(screen.getByTestId('eoc-title-1'), {
      target: { value: 'Permits and approvals' }
    })
    // Typing is not saving.
    expect(mockUpdate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('eoc-save-1'))

    // The untouched description is not sent.
    expect(mockUpdate).toHaveBeenCalledWith({
      evidenceRequirementId: 1,
      title: 'Permits and approvals',
      analystReview: 'Permits verified.'
    })
  })

  it('Cancel restores what was there and writes nothing', () => {
    render(<EvidenceOfCompletion designatedActionId="9" allowEdit />, {
      wrapper
    })

    fireEvent.click(screen.getByTestId('eoc-edit-1'))
    fireEvent.change(screen.getByTestId('eoc-review-1'), {
      target: { value: 'Half a thought' }
    })
    fireEvent.click(screen.getByTestId('eoc-cancel-1'))

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(screen.getByTestId('eoc-review-1')).toHaveValue('')
    expect(screen.queryByTestId('eoc-save-1')).not.toBeInTheDocument()
  })

  it('will not save an item with its title blanked', () => {
    render(<EvidenceOfCompletion designatedActionId="9" allowEdit />, {
      wrapper
    })

    fireEvent.click(screen.getByTestId('eoc-edit-1'))
    fireEvent.change(screen.getByTestId('eoc-title-1'), {
      target: { value: '   ' }
    })

    expect(screen.getByTestId('eoc-save-1')).toBeDisabled()
  })

  it('shows the notes box only when notes are toggled on', () => {
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })
    expect(screen.queryByTestId('eoc-notes-1')).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByTestId('eoc-notes-toggle-1').querySelector('input')
    )

    expect(screen.getByTestId('eoc-notes-1')).toBeInTheDocument()
  })

  it('opens the notes box already for a requirement that has notes', () => {
    mockList.mockReturnValue({
      data: [requirement({ reviewNotes: 'Copies filed.' })],
      isLoading: false
    })
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    expect(screen.getByTestId('eoc-notes-1')).toBeInTheDocument()
  })

  it('creates a requirement from the modal with a title and description', () => {
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    fireEvent.click(screen.getByTestId('eoc-add-button'))
    fireEvent.change(screen.getByTestId('eoc-new-title'), {
      target: { value: 'Risk register' }
    })
    fireEvent.change(screen.getByTestId('eoc-new-description'), {
      target: { value: 'Identification of risks and mitigations' }
    })
    fireEvent.click(
      screen.getByText('initiativeAgreement:evidence.createRequirement')
    )

    expect(mockCreate).toHaveBeenCalledWith({
      title: 'Risk register',
      description: 'Identification of risks and mitigations'
    })
  })

  it('will not create a requirement without both a title and a description', () => {
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    fireEvent.click(screen.getByTestId('eoc-add-button'))
    fireEvent.change(screen.getByTestId('eoc-new-title'), {
      target: { value: 'Risk register' }
    })
    // Asserting the behaviour rather than the button's disabled state:
    // the point is that nothing is created from a half-filled form.
    fireEvent.click(
      screen.getByText('initiativeAgreement:evidence.createRequirement')
    )

    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('cancelling the modal creates nothing', () => {
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    fireEvent.click(screen.getByTestId('eoc-add-button'))
    fireEvent.change(screen.getByTestId('eoc-new-title'), {
      target: { value: 'Risk register' }
    })
    fireEvent.change(screen.getByTestId('eoc-new-description'), {
      target: { value: 'Identification of risks' }
    })
    fireEvent.click(screen.getByText('common:cancelBtn'))

    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('acknowledges an outcome decision, which still takes effect at once', () => {
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    expect(screen.queryByTestId('eoc-saved-1')).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByTestId('eoc-satisfactory-1').querySelector('input')
    )

    expect(screen.getByTestId('eoc-saved-1')).toBeInTheDocument()
  })

  it('removes a requirement', () => {
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    fireEvent.click(screen.getByTestId('eoc-remove-1'))

    expect(mockRemove).toHaveBeenCalledWith(1)
  })

  it('hides Add EOC from a director', () => {
    mockRoles = [roles.director]
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    expect(screen.queryByTestId('eoc-add-button')).not.toBeInTheDocument()
  })

  it('collapses the section', () => {
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    const toggle = screen.getByTestId('eoc-toggle')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows an empty state when nothing has been added', () => {
    mockList.mockReturnValue({ data: [], isLoading: false })
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    expect(
      screen.getByText('initiativeAgreement:evidence.empty')
    ).toBeInTheDocument()
  })

  it('always shows the Missing information box, even with nothing added (#5118)', () => {
    mockList.mockReturnValue({ data: [], isLoading: false })
    render(
      <EvidenceOfCompletion
        designatedActionId="9"
        missingInformation="The signed stage two permit."
      />,
      { wrapper }
    )

    expect(screen.getByTestId('eoc-missing-information')).toBeInTheDocument()
    expect(
      screen.getByLabelText('initiativeAgreement:evidence.missingInformation')
    ).toHaveValue('The signed stage two permit.')
  })

  it('hands edits to the Missing information box back to the page', () => {
    const onChange = vi.fn()
    const onBlur = vi.fn()
    render(
      <EvidenceOfCompletion
        designatedActionId="9"
        missingInformation=""
        onMissingInformationChange={onChange}
        onMissingInformationBlur={onBlur}
      />,
      { wrapper }
    )

    const box = screen.getByTestId('eoc-missing-information-input')
    fireEvent.change(box, { target: { value: 'The risk register.' } })
    fireEvent.blur(box)

    expect(onChange).toHaveBeenCalledWith('The risk register.')
    expect(onBlur).toHaveBeenCalled()
  })

  it('shows the Missing information read-only when the page says so', () => {
    render(
      <EvidenceOfCompletion
        designatedActionId="9"
        missingInformation="The signed stage two permit."
        missingInformationReadOnly
      />,
      { wrapper }
    )

    // Read-only rather than disabled, so it keeps its contrast.
    const box = screen.getByTestId('eoc-missing-information-input')
    expect(box).toHaveAttribute('readonly')
    expect(box).not.toBeDisabled()
  })

  it('names each outcome in the review summary', () => {
    mockList.mockReturnValue({
      data: [
        requirement({ reviewOutcome: OUTCOME_SATISFACTORY }),
        requirement({
          evidenceRequirementId: 2,
          requirementNumber: 2,
          title: 'Risks',
          reviewOutcome: OUTCOME_INFORMATION_REQUESTED
        }),
        requirement({
          evidenceRequirementId: 3,
          requirementNumber: 3,
          title: 'Letter'
        })
      ],
      isLoading: false
    })
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    // The icons carry the outcome, so each needs a name, and the gold
    // one still says which kind of outstanding.
    const names = [
      ...screen.getByTestId('eoc-review-summary').querySelectorAll('svg title')
    ].map((title) => title.textContent)
    expect(names).toEqual([
      'initiativeAgreement:evidence.satisfactory',
      'initiativeAgreement:evidence.requestInformation',
      'initiativeAgreement:evidence.pending'
    ])
  })
})
