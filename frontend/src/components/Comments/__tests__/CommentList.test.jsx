import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import { roles } from '@/constants/roles'
import CommentList from '../CommentList'

const mockUserState = vi.hoisted(() => ({
  roles: ['Government'],
  username: 'idir-user'
}))

vi.mock('react-quill', () => {
  const ReactQuill = ({ value, onChange }) => (
    <textarea
      aria-label="Comment editor"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  )
  // Mirror the real module: Quill is a static property of the default export.
  ReactQuill.Quill = { import: () => ({}) }
  return { default: ReactQuill }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => {
      const translations = {
        'internalComment:addComment': 'Add comment',
        'internalComment:allComments': 'All comments',
        'internalComment:commentFilterTabs': 'Comment filters',
        'internalComment:commentToDirector':
          'Comments to the director to support your recommendation (optional):',
        'internalComment:edit': 'Edit',
        'internalComment:edited': 'Edited',
        'internalComment:internal': 'Internal',
        'internalComment:internalComments': 'Internal comments',
        'internalComment:public': 'Public',
        'internalComment:publicComments': 'Public comments',
        'internalComment:cancel': 'Cancel',
        'internalComment:editComment': 'Edit comment:',
        'internalComment:postComment': 'Post comment',
        'internalComment:publicCommentConfirmText':
          'This comment will be visible outside the internal team.',
        'internalComment:publicCommentConfirmTitle': 'Post public comment?',
        'internalComment:saveChanges': 'Save Changes',
        'internalComment:sortCommentsLabel': 'Sort comments',
        'internalComment:sortNewestFirst': 'Sort newest first',
        'internalComment:sortOldestFirst': 'Sort oldest first'
      }
      if (key === 'internalComment:editedBy') {
        return `Edited by ${options?.name}`
      }
      return translations[key] || key
    }
  })
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { keycloakUsername: mockUserState.username },
    hasAnyRole: (...names) =>
      names.some((name) => mockUserState.roles.includes(name))
  })
}))

const baseProps = {
  comments: [
    {
      internalCommentId: 3,
      comment: 'Internal comment body',
      fullName: 'Internal User',
      createDate: '2026-06-01T12:00:00Z',
      visibility: 'Internal',
      createUser: 'other-user'
    },
    {
      internalCommentId: 2,
      comment: 'Public comment body',
      fullName: 'Public User',
      createDate: '2026-06-02T12:00:00Z',
      visibility: 'Public',
      createUser: 'other-user'
    }
  ],
  onAddComment: vi.fn(),
  onEditComment: vi.fn(),
  isAddingComment: false,
  isEditingComment: false,
  commentInput: '',
  onCommentInputChange: vi.fn(),
  commentMode: 'dual',
  visibility: 'Internal',
  onVisibilityChange: vi.fn(),
  allowInternalVisibility: true
}

describe('CommentList comment filters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserState.roles = [roles.government]
    mockUserState.username = 'idir-user'
  })

  it('defaults to all comments for IDIR dual-mode users', () => {
    render(<CommentList {...baseProps} />, { wrapper })

    expect(screen.getByRole('tab', { name: 'All comments' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByText('Internal comment body')).toBeInTheDocument()
    expect(screen.getByText('Public comment body')).toBeInTheDocument()
  })

  it('filters between internal, public, and all comments without reloading', () => {
    render(<CommentList {...baseProps} />, { wrapper })

    fireEvent.click(screen.getByRole('tab', { name: 'Internal comments' }))
    expect(screen.getByText('Internal comment body')).toBeInTheDocument()
    expect(screen.queryByText('Public comment body')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Public comments' }))
    expect(screen.queryByText('Internal comment body')).not.toBeInTheDocument()
    expect(screen.getByText('Public comment body')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'All comments' }))
    expect(screen.getByText('Internal comment body')).toBeInTheDocument()
    expect(screen.getByText('Public comment body')).toBeInTheDocument()
  })

  it('changes sort order from the sort tabs', () => {
    const onSortOrderChange = vi.fn()

    render(
      <CommentList
        {...baseProps}
        sortOrder="desc"
        onSortOrderChange={onSortOrderChange}
      />,
      { wrapper }
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Sort oldest first' }))

    expect(onSortOrderChange).toHaveBeenCalledWith('asc')
  })

  it('resets filter and sort order after adding a comment', async () => {
    const onAddComment = vi.fn().mockResolvedValue({})
    const onSortOrderChange = vi.fn()

    render(
      <CommentList
        {...baseProps}
        onAddComment={onAddComment}
        commentInput="New internal comment"
        sortOrder="asc"
        onSortOrderChange={onSortOrderChange}
      />,
      { wrapper }
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Internal comments' }))
    expect(
      screen.getByRole('tab', { name: 'Internal comments' })
    ).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }))

    await waitFor(() => expect(onAddComment).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'All comments' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    )
    expect(onSortOrderChange).toHaveBeenCalledWith('desc')
  })

  it('confirms before posting a public comment', async () => {
    const onAddComment = vi.fn().mockResolvedValue({})

    render(
      <CommentList
        {...baseProps}
        onAddComment={onAddComment}
        commentInput="New public comment"
        visibility="Public"
      />,
      { wrapper }
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }))

    expect(onAddComment).not.toHaveBeenCalled()
    expect(screen.getByText('Post public comment?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onAddComment).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }))
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))

    await waitFor(() => expect(onAddComment).toHaveBeenCalled())
  })

  it('confirms before changing an internal comment to public', async () => {
    const onEditComment = vi.fn()

    render(
      <CommentList
        {...baseProps}
        onEditComment={onEditComment}
        comments={[
          {
            internalCommentId: 9,
            comment: 'Internal editable comment',
            fullName: 'IDIR User',
            createDate: '2026-06-01T12:00:00Z',
            visibility: 'Internal',
            createUser: 'idir-user'
          }
        ]}
      />,
      { wrapper }
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getAllByRole('radio', { name: 'Public' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(onEditComment).not.toHaveBeenCalled()
    expect(screen.getByText('Post public comment?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))

    await waitFor(() => expect(onEditComment).toHaveBeenCalled())
  })

  it('renders sort tabs but not filter tabs for BCeID dual-mode users', () => {
    mockUserState.roles = [roles.ci_applicant]
    const onSortOrderChange = vi.fn()

    render(
      <CommentList {...baseProps} onSortOrderChange={onSortOrderChange} />,
      { wrapper }
    )

    expect(screen.queryByTestId('comment-filter-tabs')).not.toBeInTheDocument()
    expect(screen.getByTestId('comment-sort-toggle')).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'Sort newest first' })
    ).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'Sort oldest first' }))
    expect(onSortOrderChange).toHaveBeenCalledWith('asc')
    expect(screen.getByText('Internal comment body')).toBeInTheDocument()
    expect(screen.getByText('Public comment body')).toBeInTheDocument()
  })
})

describe('CommentList attachments', () => {
  const attachmentProps = {
    ...baseProps,
    enableAttachments: true,
    attachments: [],
    onAttachmentsChange: vi.fn(),
    onDownloadAttachment: vi.fn(),
    comments: [
      {
        internalCommentId: 7,
        comment: 'Comment with files',
        fullName: 'Author',
        createDate: '2026-06-01T12:00:00Z',
        visibility: 'Internal',
        createUser: 'other-user',
        documents: [
          { documentId: 11, fileName: 'spec.pdf' },
          { documentId: 12, fileName: 'data.csv' }
        ]
      }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUserState.roles = [roles.government]
    mockUserState.username = 'idir-user'
  })

  it('renders attachment download links and downloads on click', () => {
    render(<CommentList {...attachmentProps} />, { wrapper })

    const link = screen.getByText('spec.pdf')
    expect(link).toBeInTheDocument()
    expect(screen.getByText('data.csv')).toBeInTheDocument()

    fireEvent.click(link)
    expect(attachmentProps.onDownloadAttachment).toHaveBeenCalledWith(
      7,
      11,
      'spec.pdf'
    )
  })

  it('renders the attach file input on the add form', () => {
    const { container } = render(<CommentList {...attachmentProps} />, {
      wrapper
    })
    expect(
      container.querySelector('[data-test="comment-attachment-input"]')
    ).toBeInTheDocument()
  })

  it('stages a valid selected file via onAttachmentsChange', () => {
    const onAttachmentsChange = vi.fn()
    const { container } = render(
      <CommentList
        {...attachmentProps}
        onAttachmentsChange={onAttachmentsChange}
      />,
      { wrapper }
    )
    const input = container.querySelector(
      '[data-test="comment-attachment-input"]'
    )
    const file = new File(['x'], 'note.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(onAttachmentsChange).toHaveBeenCalledWith([file])
  })

  it('does not render the attach input when attachments are disabled', () => {
    const { container } = render(
      <CommentList {...attachmentProps} enableAttachments={false} />,
      { wrapper }
    )
    expect(
      container.querySelector('[data-test="comment-attachment-input"]')
    ).not.toBeInTheDocument()
  })
})

describe('CommentList admin edit mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserState.username = 'idir-user'
  })

  it('only shows the edit link for the original author when the user is not an admin', () => {
    mockUserState.roles = [roles.government, roles.analyst]
    mockUserState.username = 'analyst-user'

    const props = {
      ...baseProps,
      comments: [
        {
          internalCommentId: 10,
          comment: 'Mine',
          fullName: 'Analyst User',
          createDate: '2026-06-01T12:00:00Z',
          visibility: 'Internal',
          createUser: 'analyst-user'
        },
        {
          internalCommentId: 11,
          comment: 'Theirs',
          fullName: 'Other User',
          createDate: '2026-06-02T12:00:00Z',
          visibility: 'Internal',
          createUser: 'someone-else'
        }
      ]
    }

    render(<CommentList {...props} />, { wrapper })

    const editLinks = screen.getAllByTestId('comment-edit-link')
    // Only the author's own comment should expose an edit affordance.
    expect(editLinks).toHaveLength(1)
  })

  it('shows the edit link on every comment when the user has the Administrator role', () => {
    mockUserState.roles = [roles.government, roles.administrator]
    mockUserState.username = 'admin-user'

    const props = {
      ...baseProps,
      comments: [
        {
          internalCommentId: 20,
          comment: 'One',
          fullName: 'Alice',
          createDate: '2026-06-01T12:00:00Z',
          visibility: 'Internal',
          createUser: 'alice'
        },
        {
          internalCommentId: 21,
          comment: 'Two',
          fullName: 'Bob',
          createDate: '2026-06-02T12:00:00Z',
          visibility: 'Public',
          createUser: 'bob'
        }
      ]
    }

    render(<CommentList {...props} />, { wrapper })

    const editLinks = screen.getAllByTestId('comment-edit-link')
    // Admin can edit every comment regardless of author.
    expect(editLinks).toHaveLength(2)
  })

  it("does not show the edit link on other users' comments when the user only has the System Admin role", () => {
    mockUserState.roles = [roles.system_admin]
    mockUserState.username = 'sysadmin'

    const props = {
      ...baseProps,
      comments: [
        {
          internalCommentId: 30,
          comment: 'One',
          fullName: 'Alice',
          createDate: '2026-06-01T12:00:00Z',
          visibility: 'Internal',
          createUser: 'alice'
        },
        {
          internalCommentId: 31,
          comment: 'Two',
          fullName: 'Bob',
          createDate: '2026-06-02T12:00:00Z',
          visibility: 'Public',
          createUser: 'bob'
        }
      ]
    }

    render(<CommentList {...props} />, { wrapper })

    expect(screen.queryAllByTestId('comment-edit-link')).toHaveLength(0)
  })

  it("shows the editor name on the edited indicator when an admin edited another user's comment", () => {
    mockUserState.roles = [roles.government]
    mockUserState.username = 'reader'

    const props = {
      ...baseProps,
      comments: [
        {
          internalCommentId: 40,
          comment: 'Edited by admin',
          fullName: 'Alice',
          createDate: '2026-06-01T12:00:00Z',
          updateDate: '2026-06-15T08:30:00Z',
          updateUser: 'admin-user',
          updateFullName: 'Admin User',
          visibility: 'Internal',
          createUser: 'alice'
        }
      ]
    }

    render(<CommentList {...props} />, { wrapper })

    const indicator = screen.getByTestId('comment-edited-indicator')
    expect(indicator.textContent).toContain('Edited by Admin User')
  })

  it('shows the plain "Edited" indicator when the author edited their own comment', () => {
    mockUserState.roles = [roles.government]
    mockUserState.username = 'reader'

    const props = {
      ...baseProps,
      comments: [
        {
          internalCommentId: 50,
          comment: 'Self-edited',
          fullName: 'Alice',
          createDate: '2026-06-01T12:00:00Z',
          updateDate: '2026-06-15T08:30:00Z',
          updateUser: 'alice',
          updateFullName: 'Alice',
          visibility: 'Internal',
          createUser: 'alice'
        }
      ]
    }

    render(<CommentList {...props} />, { wrapper })

    const indicator = screen.getByTestId('comment-edited-indicator')
    expect(indicator.textContent).toBe('Edited')
  })
})
