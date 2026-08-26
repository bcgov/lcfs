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
  useCreateEvidenceRequirement: () => ({ mutate: mockCreate }),
  useUpdateEvidenceRequirement: () => ({ mutate: mockUpdate }),
  useDeleteEvidenceRequirement: () => ({ mutate: mockRemove })
}))

const requirement = (overrides = {}) => ({
  evidenceRequirementId: 1,
  designatedActionId: 9,
  requirementNumber: 1,
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

    // The title appears twice on purpose: once on the card, once in the
    // review summary, matching the wireframe.
    expect(screen.getByTestId('eoc-card-1')).toHaveTextContent(
      'List of major permits and approvals'
    )
    expect(screen.getByTestId('eoc-review-summary')).toHaveTextContent(
      'List of major permits and approvals'
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

  it('saves the narrative when the box loses focus, and not before', () => {
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    const box = screen.getByTestId('eoc-review-1')
    fireEvent.change(box, { target: { value: 'Permits verified.' } })
    expect(mockUpdate).not.toHaveBeenCalled()

    fireEvent.blur(box)
    expect(mockUpdate).toHaveBeenCalledWith({
      evidenceRequirementId: 1,
      analystReview: 'Permits verified.'
    })
  })

  it('does not save an unchanged narrative on blur', () => {
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    fireEvent.blur(screen.getByTestId('eoc-review-1'))

    expect(mockUpdate).not.toHaveBeenCalled()
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

  it('adds a requirement with Enter and abandons it with Escape', () => {
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    fireEvent.click(screen.getByTestId('eoc-add-button'))
    const input = screen.getByTestId('eoc-new-description')
    fireEvent.change(input, { target: { value: 'Risk register' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockCreate).toHaveBeenCalledWith({ description: 'Risk register' })

    fireEvent.click(screen.getByTestId('eoc-add-button'))
    fireEvent.keyDown(screen.getByTestId('eoc-new-description'), {
      key: 'Escape'
    })
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('creates a requirement from the button, not only from Enter', () => {
    render(<EvidenceOfCompletion designatedActionId="9" />, { wrapper })

    fireEvent.click(screen.getByTestId('eoc-add-button'))
    // Nothing to create yet, so the button says so.
    expect(screen.getByTestId('eoc-new-create')).toBeDisabled()

    fireEvent.change(screen.getByTestId('eoc-new-description'), {
      target: { value: 'Risk register' }
    })
    fireEvent.click(screen.getByTestId('eoc-new-create'))

    expect(mockCreate).toHaveBeenCalledWith({ description: 'Risk register' })
  })

  it('acknowledges a save so the autosave is visible', () => {
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
})
