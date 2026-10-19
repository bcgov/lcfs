import 'react'
import { fireEvent, screen } from '@testing-library/react'

import { describe, expect, vi, beforeEach } from 'vitest'

import {
  EvidenceOfCompletion,
  OUTCOME_INFORMATION_REQUESTED,
  OUTCOME_SATISFACTORY
} from '../EvidenceOfCompletion'
import { roles } from '@/constants/roles'
import { test } from '@/tests/utils/fixtures'

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
  missingInformation: null,
  reviewedBy: null,
  reviewedDate: null,
  ...overrides
})

const openEoc = (id = 1) =>
  fireEvent.click(screen.getByTestId(`eoc-heading-${id}`))

describe('EvidenceOfCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoles = [roles.ia_analyst]
    mockList.mockReturnValue({ data: [requirement()], isLoading: false })
  })

  test('renders a collapsed EOC header with controls and no Summary section', ({
    render,
    app
  }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

    expect(screen.getByTestId('eoc-heading-1')).toHaveTextContent('Permits')
    expect(screen.getByTestId('eoc-request-1')).toBeInTheDocument()
    expect(screen.getByTestId('eoc-satisfactory-1')).toBeInTheDocument()
    expect(screen.getByTestId('eoc-description-1')).not.toBeVisible()
    expect(screen.queryByTestId('eoc-review-summary')).not.toBeInTheDocument()
    expect(screen.getByTestId('eoc-card-1')).toHaveAttribute(
      'data-review-state',
      'unreviewed'
    )

    openEoc()
    expect(screen.getByTestId('eoc-description-1')).toHaveValue(
      'List of major permits and approvals'
    )
  })

  test('records a satisfactory assessment', ({ render, app }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

    fireEvent.click(
      screen.getByTestId('eoc-satisfactory-1').querySelector('input')
    )

    expect(mockUpdate).toHaveBeenCalledWith({
      evidenceRequirementId: 1,
      reviewOutcome: OUTCOME_SATISFACTORY
    })
    expect(screen.getByTestId('eoc-summary-1')).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(screen.getByTestId('eoc-card-1')).toHaveAttribute(
      'data-review-state',
      'satisfactory'
    )
  })

  test('records a request for information', ({ render, app }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

    fireEvent.click(screen.getByTestId('eoc-request-1').querySelector('input'))

    expect(mockUpdate).toHaveBeenCalledWith({
      evidenceRequirementId: 1,
      reviewOutcome: OUTCOME_INFORMATION_REQUESTED
    })
    expect(screen.getByTestId('eoc-summary-1')).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(screen.getByTestId('eoc-card-1')).toHaveAttribute(
      'data-review-state',
      'information-requested'
    )
    expect(screen.getByTestId('eoc-missing-information-1')).toBeInTheDocument()
  })

  test('clicking the ticked outcome returns it to unreviewed', ({
    render,
    app
  }) => {
    mockList.mockReturnValue({
      data: [requirement({ reviewOutcome: OUTCOME_SATISFACTORY })],
      isLoading: false
    })
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

    fireEvent.click(
      screen.getByTestId('eoc-satisfactory-1').querySelector('input')
    )

    expect(mockUpdate).toHaveBeenCalledWith({
      evidenceRequirementId: 1,
      clearReviewOutcome: true
    })
  })

  test('the two outcomes are mutually exclusive', ({ render, app }) => {
    mockList.mockReturnValue({
      data: [requirement({ reviewOutcome: OUTCOME_SATISFACTORY })],
      isLoading: false
    })
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

    expect(
      screen.getByTestId('eoc-satisfactory-1').querySelector('input')
    ).toBeChecked()
    expect(
      screen.getByTestId('eoc-request-1').querySelector('input')
    ).not.toBeChecked()
    expect(screen.getByTestId('eoc-card-1')).toHaveAttribute(
      'data-review-state',
      'satisfactory'
    )
  })

  test('shows the number and title as the heading, with the evaluation always present', ({
    render,
    app
  }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

    expect(screen.getByTestId('eoc-heading-1')).toHaveTextContent('1. Permits')
    openEoc()
    // Editable in place: there is no Edit step (#5118).
    expect(screen.getByTestId('eoc-review-1')).not.toHaveAttribute('readonly')
    expect(screen.queryByTestId('eoc-edit-1')).not.toBeInTheDocument()
  })

  test('falls back to the description as the heading when there is no title', ({
    render,
    app
  }) => {
    mockList.mockReturnValue({
      data: [requirement({ title: null })],
      isLoading: false
    })
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

    expect(screen.getByTestId('eoc-heading-1')).toHaveTextContent(
      '1. List of major permits and approvals'
    )
  })

  test('saves the evaluation when the field is left, and not while typing', ({
    render,
    app
  }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    openEoc()

    const evaluation = screen.getByTestId('eoc-review-1')
    fireEvent.focus(evaluation)
    fireEvent.change(evaluation, { target: { value: 'Permits verified.' } })
    expect(mockUpdate).not.toHaveBeenCalled()

    fireEvent.blur(evaluation)

    expect(mockUpdate).toHaveBeenCalledWith({
      evidenceRequirementId: 1,
      analystReview: 'Permits verified.'
    })
    // The save is visible, not silent.
    expect(screen.getByTestId('eoc-saved-1')).toBeInTheDocument()
  })

  test('does not save a field that was left unchanged', ({ render, app }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    openEoc()

    const description = screen.getByTestId('eoc-description-1')
    fireEvent.focus(description)
    fireEvent.blur(description)

    expect(mockUpdate).not.toHaveBeenCalled()
  })

  test('saves the description when the field is left', ({ render, app }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    openEoc()

    const description = screen.getByTestId('eoc-description-1')
    fireEvent.focus(description)
    fireEvent.change(description, {
      target: { value: '  Every permit the project needs.  ' }
    })
    fireEvent.blur(description)

    expect(mockUpdate).toHaveBeenCalledWith({
      evidenceRequirementId: 1,
      description: 'Every permit the project needs.'
    })
  })

  test('puts a blanked description back instead of saving it', ({
    render,
    app
  }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    openEoc()

    const description = screen.getByTestId('eoc-description-1')
    fireEvent.focus(description)
    fireEvent.change(description, { target: { value: '   ' } })
    fireEvent.blur(description)

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(description).toHaveValue('List of major permits and approvals')
  })

  test('saves notes when the field is left', ({ render, app }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    openEoc()
    fireEvent.click(
      screen.getByTestId('eoc-notes-toggle-1').querySelector('input')
    )

    const notes = screen.getByTestId('eoc-notes-1')
    fireEvent.focus(notes)
    fireEvent.change(notes, { target: { value: 'Copies filed.' } })
    fireEvent.blur(notes)

    expect(mockUpdate).toHaveBeenCalledWith({
      evidenceRequirementId: 1,
      reviewNotes: 'Copies filed.'
    })
  })

  test('keeps what is being typed when the list refreshes underneath it', ({
    render,
    app
  }) => {
    const { rerender } = render(
      <EvidenceOfCompletion designatedActionId="9" />,
      app
    )
    openEoc()
    const evaluation = screen.getByTestId('eoc-review-1')
    fireEvent.focus(evaluation)
    fireEvent.change(evaluation, { target: { value: 'Half a thought' } })

    // Another save refetches the list while this field is still focused.
    mockList.mockReturnValue({
      data: [requirement({ analystReview: 'Saved elsewhere' })],
      isLoading: false
    })
    rerender(<EvidenceOfCompletion designatedActionId="9" />)

    expect(screen.getByTestId('eoc-review-1')).toHaveValue('Half a thought')
  })

  test('offers no editing to someone who cannot edit', ({ render, app }) => {
    render(<EvidenceOfCompletion designatedActionId="9" canEdit={false} />, app)

    openEoc()
    expect(screen.queryByTestId('eoc-remove-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('eoc-review-1')).toHaveAttribute('readonly')
    expect(screen.getByTestId('eoc-description-1')).toHaveAttribute('readonly')
    expect(
      screen.getByTestId('eoc-satisfactory-1').querySelector('input')
    ).toBeDisabled()
  })

  test('shows the notes box only when notes are toggled on', ({
    render,
    app
  }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    openEoc()
    expect(screen.queryByTestId('eoc-notes-1')).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByTestId('eoc-notes-toggle-1').querySelector('input')
    )

    expect(screen.getByTestId('eoc-notes-1')).toBeInTheDocument()
  })

  test('opens the notes box already for a requirement that has notes', ({
    render,
    app
  }) => {
    mockList.mockReturnValue({
      data: [requirement({ reviewNotes: 'Copies filed.' })],
      isLoading: false
    })
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

    openEoc()
    expect(screen.getByTestId('eoc-notes-1')).toBeInTheDocument()
  })

  test('creates a requirement from the modal with a title and description', ({
    render,
    app
  }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

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

  test('will not create a requirement without both a title and a description', ({
    render,
    app
  }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

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

  test('cancelling the modal creates nothing', ({ render, app }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

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

  test('acknowledges an outcome decision, which still takes effect at once', ({
    render,
    app
  }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

    expect(screen.queryByTestId('eoc-saved-1')).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByTestId('eoc-satisfactory-1').querySelector('input')
    )

    expect(screen.getByTestId('eoc-saved-1')).toBeInTheDocument()
  })

  test('asks before removing a requirement, and removes it on confirm', ({
    render,
    app
  }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

    openEoc()
    fireEvent.click(screen.getByTestId('eoc-remove-1'))

    // Nothing is removed until the user confirms.
    expect(mockRemove).not.toHaveBeenCalled()
    expect(screen.getByTestId('eoc-remove-confirm-1')).toHaveTextContent(
      'initiativeAgreement:evidence.confirmRemoveBody'
    )

    fireEvent.click(
      screen.getByText('initiativeAgreement:evidence.confirmRemove')
    )

    expect(mockRemove).toHaveBeenCalledWith(1)
  })

  test('cancelling the removal keeps the requirement', ({ render, app }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

    openEoc()
    fireEvent.click(screen.getByTestId('eoc-remove-1'))
    fireEvent.click(screen.getByText('common:cancelBtn'))

    expect(mockRemove).not.toHaveBeenCalled()
  })

  test('hides Add EOC from a director', ({ render, app }) => {
    mockRoles = [roles.director]
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

    expect(screen.queryByTestId('eoc-add-button')).not.toBeInTheDocument()
  })

  test('collapses the section', ({ render, app }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

    const toggle = screen.getByTestId('eoc-toggle')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('shows an empty state when nothing has been added', ({
    render,
    app
  }) => {
    mockList.mockReturnValue({ data: [], isLoading: false })
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

    expect(
      screen.getByText('initiativeAgreement:evidence.empty')
    ).toBeInTheDocument()
  })

  test('shows Missing information only for a requested EOC and saves it per EOC', ({
    render,
    app
  }) => {
    mockList.mockReturnValue({
      data: [
        requirement({
          reviewOutcome: OUTCOME_INFORMATION_REQUESTED,
          missingInformation: 'The signed permit.'
        }),
        requirement({
          evidenceRequirementId: 2,
          requirementNumber: 2,
          title: 'Risk register',
          description: 'Risk register',
          reviewOutcome: OUTCOME_INFORMATION_REQUESTED,
          missingInformation: 'Update the mitigation owners.'
        }),
        requirement({
          evidenceRequirementId: 3,
          requirementNumber: 3,
          title: 'Completion letter',
          reviewOutcome: OUTCOME_SATISFACTORY,
          missingInformation: 'Must remain saved.'
        })
      ],
      isLoading: false
    })
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

    expect(
      screen.queryByTestId('eoc-missing-information-3')
    ).not.toBeInTheDocument()

    openEoc(1)
    const first = screen.getByTestId('eoc-missing-information-1')
    expect(first).toHaveValue('The signed permit.')
    fireEvent.focus(first)
    fireEvent.change(first, { target: { value: 'The updated permit.' } })
    fireEvent.blur(first)
    expect(mockUpdate).toHaveBeenCalledWith({
      evidenceRequirementId: 1,
      missingInformation: 'The updated permit.'
    })

    openEoc(2)
    expect(screen.getByTestId('eoc-missing-information-2')).toHaveValue(
      'Update the mitigation owners.'
    )
  })

  test('persists individual request values when the page is reopened', ({
    render,
    app
  }) => {
    mockList.mockReturnValue({
      data: [
        requirement({
          reviewOutcome: OUTCOME_INFORMATION_REQUESTED,
          missingInformation: 'The signed permit.'
        }),
        requirement({
          evidenceRequirementId: 2,
          requirementNumber: 2,
          title: 'Risks',
          reviewOutcome: OUTCOME_INFORMATION_REQUESTED,
          missingInformation: 'The updated risk register.'
        })
      ],
      isLoading: false
    })
    render(
      <EvidenceOfCompletion
        designatedActionId="9"
        missingInformationReadOnly
      />,
      app
    )

    openEoc(1)
    const first = screen.getByTestId('eoc-missing-information-1')
    expect(first).toHaveValue('The signed permit.')
    expect(first).toHaveAttribute('readonly')
    expect(first).not.toBeDisabled()
    openEoc(2)
    expect(screen.getByTestId('eoc-missing-information-2')).toHaveValue(
      'The updated risk register.'
    )
  })

  test('offers the request action in requested EOCs and blocks incomplete requests', ({
    render,
    app
  }) => {
    mockList.mockReturnValue({
      data: [
        requirement({
          reviewOutcome: OUTCOME_INFORMATION_REQUESTED,
          missingInformation: 'The signed permit.'
        }),
        requirement({
          evidenceRequirementId: 2,
          requirementNumber: 2,
          title: 'Risks',
          reviewOutcome: OUTCOME_INFORMATION_REQUESTED
        }),
        requirement({
          evidenceRequirementId: 3,
          requirementNumber: 3,
          title: 'Letter',
          reviewOutcome: OUTCOME_SATISFACTORY
        })
      ],
      isLoading: false
    })
    const renderRequestAction = vi.fn((item, complete) => (
      <div
        data-test={`request-action-${item.evidenceRequirementId}`}
        data-complete={String(complete)}
      />
    ))
    render(
      <EvidenceOfCompletion
        designatedActionId="9"
        renderRequestAction={renderRequestAction}
      />,
      app
    )

    expect(screen.getByTestId('request-action-1')).toHaveAttribute(
      'data-complete',
      'false'
    )
    expect(screen.getByTestId('request-action-2')).toHaveAttribute(
      'data-complete',
      'false'
    )
    expect(screen.queryByTestId('request-action-3')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('eoc-incomplete-request')).toHaveLength(2)
  })

  test('renders grey, yellow and green accordion states for multiple EOCs', ({
    render,
    app
  }) => {
    mockList.mockReturnValue({
      data: [
        requirement(),
        requirement({
          evidenceRequirementId: 2,
          requirementNumber: 2,
          reviewOutcome: OUTCOME_INFORMATION_REQUESTED
        }),
        requirement({
          evidenceRequirementId: 3,
          requirementNumber: 3,
          reviewOutcome: OUTCOME_SATISFACTORY
        })
      ],
      isLoading: false
    })
    render(<EvidenceOfCompletion designatedActionId="9" />, app)

    expect(screen.getByTestId('eoc-card-1')).toHaveAttribute(
      'data-review-state',
      'unreviewed'
    )
    expect(screen.getByTestId('eoc-card-2')).toHaveAttribute(
      'data-review-state',
      'information-requested'
    )
    expect(screen.getByTestId('eoc-card-3')).toHaveAttribute(
      'data-review-state',
      'satisfactory'
    )
  })
})
