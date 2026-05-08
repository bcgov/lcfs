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

const mockAddComment = vi.fn().mockResolvedValue(null)
const mockRecordDecision = vi.fn().mockResolvedValue(null)
let mockComments = []
let mockIsLoadingComments = false

vi.mock('@/hooks/useCIApplication', () => ({
  useGetCIComments: vi.fn(() => ({
    data: mockComments,
    isLoading: mockIsLoadingComments
  })),
  useAddCIComment: vi.fn(() => ({
    mutateAsync: mockAddComment,
    isPending: false
  })),
  useRecordCIDecision: vi.fn(() => ({
    mutateAsync: mockRecordDecision,
    isPending: false
  }))
}))

let mockUserRoles = [{ name: roles.ci_applicant }]
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { roles: mockUserRoles },
    hasRoles: (...names) =>
      names.every((name) =>
        mockUserRoles.some((r) => r.name === name)
      ),
    hasAnyRole: (...names) =>
      names.some((name) =>
        mockUserRoles.some((r) => r.name === name)
      )
  })
}))

import { GovernmentDecisionStep } from '@/views/CarbonIntensity/components/GovernmentDecisionStep'

const baseCi = { ciApplicationId: 10, status: { status: 'Submitted' } }

describe('GovernmentDecisionStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockComments = []
    mockIsLoadingComments = false
    mockUserRoles = [{ name: roles.ci_applicant }]
  })
  afterEach(cleanup)

  it('renders the empty thread placeholder when there are no comments', () => {
    render(<GovernmentDecisionStep ciApplication={baseCi} />, { wrapper })
    expect(screen.getByTestId('ci-step5-thread')).toBeInTheDocument()
    expect(
      screen.getByText('carbonIntensity:step5.noComments')
    ).toBeInTheDocument()
  })

  it('renders comments from the thread', () => {
    mockComments = [
      {
        commentId: 1,
        text: 'Hello there',
        authorDisplayName: 'Jane Doe',
        authorUsername: 'jdoe',
        isGovernment: false,
        createDate: '2026-05-08T12:00:00Z'
      },
      {
        commentId: 2,
        text: 'Got it.',
        authorDisplayName: 'Govt Analyst',
        authorUsername: 'gov_analyst',
        isGovernment: true,
        createDate: '2026-05-08T13:00:00Z'
      }
    ]
    render(<GovernmentDecisionStep ciApplication={baseCi} />, { wrapper })
    const items = screen.getAllByTestId('ci-step5-comment')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('Jane Doe')
    expect(items[0].textContent).toContain('Hello there')
  })

  it('rejects empty comment submissions', async () => {
    render(<GovernmentDecisionStep ciApplication={baseCi} />, { wrapper })
    fireEvent.click(screen.getByTestId('ci-step5-add-comment-btn'))
    await waitFor(() => {
      expect(
        screen.getByText('carbonIntensity:step5.commentRequired')
      ).toBeInTheDocument()
    })
    expect(mockAddComment).not.toHaveBeenCalled()
  })

  it('posts a comment via the hook', async () => {
    render(<GovernmentDecisionStep ciApplication={baseCi} />, { wrapper })
    fireEvent.change(screen.getByTestId('ci-step5-comment-input'), {
      target: { value: 'A new note' }
    })
    fireEvent.click(screen.getByTestId('ci-step5-add-comment-btn'))
    await waitFor(() => expect(mockAddComment).toHaveBeenCalledWith('A new note'))
  })

  it('hides the decision panel for non-government users', () => {
    render(<GovernmentDecisionStep ciApplication={baseCi} />, { wrapper })
    expect(screen.queryByTestId('ci-step5-decision-panel')).not.toBeInTheDocument()
  })

  it('shows the decision panel for government users and records Completed', async () => {
    mockUserRoles = [{ name: roles.government }]
    render(
      <GovernmentDecisionStep ciApplication={baseCi} isGovernment={true} />,
      { wrapper }
    )
    expect(screen.getByTestId('ci-step5-decision-panel')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('ci-step5-complete-btn'))
    await waitFor(() =>
      expect(mockRecordDecision).toHaveBeenCalledWith({
        status: 'Completed',
        comment: null
      })
    )
  })

  it('records Withdrawn with the typed comment as decision rationale', async () => {
    mockUserRoles = [{ name: roles.government }]
    render(
      <GovernmentDecisionStep ciApplication={baseCi} isGovernment={true} />,
      { wrapper }
    )
    fireEvent.change(screen.getByTestId('ci-step5-comment-input'), {
      target: { value: 'Insufficient information' }
    })
    fireEvent.click(screen.getByTestId('ci-step5-withdraw-btn'))
    await waitFor(() =>
      expect(mockRecordDecision).toHaveBeenCalledWith({
        status: 'Withdrawn',
        comment: 'Insufficient information'
      })
    )
  })

  it('disables the upload button when no upload handler is wired', () => {
    render(<GovernmentDecisionStep ciApplication={baseCi} />, { wrapper })
    expect(screen.getByTestId('ci-step5-upload-btn')).toBeDisabled()
  })

  it('enables the upload button when an upload handler is provided', () => {
    render(
      <GovernmentDecisionStep
        ciApplication={baseCi}
        onDocumentUploadClick={() => {}}
      />,
      { wrapper }
    )
    expect(screen.getByTestId('ci-step5-upload-btn')).not.toBeDisabled()
  })
})
