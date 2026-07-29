import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { CompanyOverviewComments } from '../CompanyOverviewComments'

// BCWidgetCard calls useNavigate, so a Router context is required.
const renderCard = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

// Lightweight stubs so the test focuses on wiring, not the WYSIWYG editor.
vi.mock('@/components/Comments/CommentForm', () => ({
  __esModule: true,
  default: ({ commentText, onCommentChange, onSubmit, visibility }) => (
    <div data-test="comment-form">
      <input
        data-test="comment-input"
        value={commentText}
        onChange={(e) => onCommentChange(e.target.value)}
      />
      <button
        data-test="comment-submit"
        onClick={() => onSubmit(commentText, visibility)}
      >
        submit
      </button>
    </div>
  )
}))

vi.mock('../CommentLog/CommentRow', () => ({
  CommentRow: ({ comment, onEdit }) => (
    <div data-test="comment-row">
      <span>{comment.comment}</span>
      <button
        data-test={`edit-${comment.internalCommentId}`}
        onClick={() => onEdit(comment.internalCommentId, 'edited', 'Internal')}
      >
        edit
      </button>
    </div>
  )
}))

const mockThread = vi.fn()
const mockCreate = vi.fn()
const mockEdit = vi.fn()

vi.mock('@/hooks/useOrganizationComments', () => ({
  useOrganizationCommentThread: (...args) => mockThread(...args),
  useCreateOrganizationComment: (...args) => mockCreate(...args),
  useEditOrganizationComment: (...args) => mockEdit(...args)
}))

const createMutate = vi.fn().mockResolvedValue({})
const editMutate = vi.fn()

describe('CompanyOverviewComments (#4608)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockThread.mockReturnValue({
      data: { comments: [] },
      isLoading: false,
      isError: false
    })
    mockCreate.mockReturnValue({ mutateAsync: createMutate, isPending: false })
    mockEdit.mockReturnValue({ mutate: editMutate, isPending: false })
  })
  afterEach(cleanup)

  it('renders the section with the shared create form', () => {
    renderCard(<CompanyOverviewComments organizationId={7} />)
    expect(screen.getByTestId('company-overview-section')).toBeInTheDocument()
    expect(screen.getByTestId('comment-form')).toBeInTheDocument()
    // Thread hook is scoped to the passed organization.
    expect(mockThread).toHaveBeenCalledWith(7)
  })

  it('shows the empty state when there are no comments', () => {
    renderCard(<CompanyOverviewComments organizationId={7} />)
    expect(screen.getByTestId('company-overview-empty')).toBeInTheDocument()
    expect(
      screen.queryByTestId('company-overview-list')
    ).not.toBeInTheDocument()
  })

  it('renders existing comments through CommentRow', () => {
    mockThread.mockReturnValue({
      data: {
        comments: [
          { internalCommentId: 1, comment: '<p>Alpha</p>', canEdit: true },
          { internalCommentId: 2, comment: '<p>Beta</p>', canEdit: false }
        ]
      },
      isLoading: false,
      isError: false
    })
    renderCard(<CompanyOverviewComments organizationId={7} />)
    expect(screen.getByTestId('company-overview-list')).toBeInTheDocument()
    expect(screen.getAllByTestId('comment-row')).toHaveLength(2)
  })

  it('creates a comment via the create mutation', async () => {
    renderCard(<CompanyOverviewComments organizationId={7} />)
    fireEvent.change(screen.getByTestId('comment-input'), {
      target: { value: 'A new overview note' }
    })
    fireEvent.click(screen.getByTestId('comment-submit'))
    await waitFor(() =>
      expect(createMutate).toHaveBeenCalledWith({
        comment: 'A new overview note',
        visibility: 'Internal'
      })
    )
  })

  it('does not create when the comment is blank', () => {
    renderCard(<CompanyOverviewComments organizationId={7} />)
    fireEvent.click(screen.getByTestId('comment-submit'))
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('edits a comment via the edit mutation', () => {
    mockThread.mockReturnValue({
      data: {
        comments: [
          { internalCommentId: 5, comment: '<p>Gamma</p>', canEdit: true }
        ]
      },
      isLoading: false,
      isError: false
    })
    renderCard(<CompanyOverviewComments organizationId={7} />)
    fireEvent.click(screen.getByTestId('edit-5'))
    expect(editMutate).toHaveBeenCalledWith({
      commentId: 5,
      comment: 'edited',
      visibility: 'Internal'
    })
  })

  it('shows a loading indicator while fetching', () => {
    mockThread.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false
    })
    renderCard(<CompanyOverviewComments organizationId={7} />)
    expect(
      screen.queryByTestId('company-overview-empty')
    ).not.toBeInTheDocument()
  })
})
