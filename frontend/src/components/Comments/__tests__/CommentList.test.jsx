import { test } from '@/tests/utils/fixtures'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { roles } from '@/constants/roles'
import CommentList from '../CommentList'

const mockUserState = vi.hoisted(() => ({
  roles: ['Government'],
  username: 'idir-user'
}))

vi.mock('react-quill', () => {
  const ReactQuill = ({ value, onChange, placeholder }) => (
    <textarea
      aria-label="Comment editor"
      value={value}
      placeholder={placeholder}
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
        'internalComment:internalOnly': 'Internal only',
        'internalComment:commentVisibility': 'Comment visibility',
        'internalComment:internalVisibilityMessage':
          'Internal only - visible to government users only.',
        'internalComment:publicVisibilityMessage':
          'Public - visible to everyone, including external parties.',
        'internalComment:internalCommentPlaceholder':
          'Write an internal note (government users only)',
        'internalComment:publicCommentPlaceholder':
          'Write a public comment (visible to external parties)',
        'internalComment:addInternalComment': 'Add internal comment',
        'internalComment:addPublicComment': 'Add public comment',
        'internalComment:internalComments': 'Internal comments',
        'internalComment:public': 'Public',
        'internalComment:publicComments': 'Public comments',
        'internalComment:cancel': 'Cancel',
        'internalComment:editComment': 'Edit comment:',
        'internalComment:newInternalComment': 'New internal comment',
        'internalComment:newPublicComment': 'New public comment',
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

  test('defaults to all comments for IDIR dual-mode users', ({
    render,
    theme
  }) => {
    render(<CommentList {...baseProps} />, [theme])

    expect(screen.getByRole('tab', { name: 'All comments' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByText('Internal comment body')).toBeInTheDocument()
    expect(screen.getByText('Public comment body')).toBeInTheDocument()
  })

  test('identifies IDIR comment visibility with labelled lock and globe badges', ({
    render,
    theme
  }) => {
    const { container } = render(<CommentList {...baseProps} />, [theme])
    const cards = container.querySelectorAll('[data-test="comment-card"]')

    expect(cards[0]).toHaveAttribute('data-visibility', 'Internal')
    expect(within(cards[0]).getByText('Internal')).toBeInTheDocument()
    expect(
      cards[0].querySelector('[data-testid="LockOutlinedIcon"]')
    ).toBeInTheDocument()
    expect(cards[1]).toHaveAttribute('data-visibility', 'Public')
    expect(within(cards[1]).getByText('Public')).toBeInTheDocument()
    expect(
      cards[1].querySelector('[data-testid="LanguageIcon"]')
    ).toBeInTheDocument()
  })

  test('updates the visibility message, placeholder, and submit action', ({
    render,
    theme
  }) => {
    const onVisibilityChange = vi.fn()
    const { rerender } = render(
      <CommentList
        {...baseProps}
        commentInput="Draft"
        onVisibilityChange={onVisibilityChange}
      />,
      [theme]
    )

    expect(
      screen.getByRole('button', { name: 'Internal only' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Add internal comment' })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Public' }))
    expect(onVisibilityChange).toHaveBeenCalledWith('Public')

    rerender(
      <CommentList
        {...baseProps}
        commentInput="Draft"
        visibility="Public"
        onVisibilityChange={onVisibilityChange}
      />
    )

    expect(screen.getByRole('button', { name: 'Public' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(
      screen.getByText(
        'Public - visible to everyone, including external parties.'
      )
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Comment editor')).toHaveAttribute(
      'placeholder',
      'Write a public comment (visible to external parties)'
    )
    expect(
      screen.getByRole('button', { name: 'Add public comment' })
    ).toBeInTheDocument()
  })

  test('filters between internal, public, and all comments without reloading', ({
    render,
    theme
  }) => {
    render(<CommentList {...baseProps} />, [theme])

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

  test('changes sort order from the sort tabs', ({ render, theme }) => {
    const onSortOrderChange = vi.fn()

    render(
      <CommentList
        {...baseProps}
        sortOrder="desc"
        onSortOrderChange={onSortOrderChange}
      />,
      [theme]
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Sort oldest first' }))

    expect(onSortOrderChange).toHaveBeenCalledWith('asc')
  })

  test('resets filter and sort order after adding a comment', async ({
    render,
    theme
  }) => {
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
      [theme]
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Internal comments' }))
    expect(
      screen.getByRole('tab', { name: 'Internal comments' })
    ).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(
      screen.getByRole('button', { name: 'Add internal comment' })
    )

    await waitFor(() => expect(onAddComment).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'All comments' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    )
    expect(onSortOrderChange).toHaveBeenCalledWith('desc')
  })

  test('confirms before posting a public comment', async ({
    render,
    theme
  }) => {
    const onAddComment = vi.fn().mockResolvedValue({})

    render(
      <CommentList
        {...baseProps}
        onAddComment={onAddComment}
        commentInput="New public comment"
        visibility="Public"
      />,
      [theme]
    )

    expect(
      screen.getByText(
        'Public - visible to everyone, including external parties.'
      )
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Comment editor')).toHaveAttribute(
      'placeholder',
      'Write a public comment (visible to external parties)'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add public comment' }))

    expect(onAddComment).not.toHaveBeenCalled()
    expect(screen.getByText('Post public comment?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onAddComment).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Add public comment' }))
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))

    await waitFor(() => expect(onAddComment).toHaveBeenCalled())
  })

  test('confirms before changing an internal comment to public', async ({
    render,
    theme
  }) => {
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
      [theme]
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Public' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(onEditComment).not.toHaveBeenCalled()
    expect(screen.getByText('Post public comment?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))

    await waitFor(() => expect(onEditComment).toHaveBeenCalled())
  })

  test('renders sort tabs but not filter tabs for BCeID dual-mode users', ({
    render,
    theme
  }) => {
    mockUserState.roles = [roles.ci_applicant]
    const onSortOrderChange = vi.fn()

    render(
      <CommentList {...baseProps} onSortOrderChange={onSortOrderChange} />,
      [theme]
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

  test('renders attachment download links and downloads on click', ({
    render,
    theme
  }) => {
    render(<CommentList {...attachmentProps} />, [theme])

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

  test('renders the attach file input on the add form', ({ render, theme }) => {
    const { container } = render(<CommentList {...attachmentProps} />, [theme])
    expect(
      container.querySelector('[data-test="comment-attachment-input"]')
    ).toBeInTheDocument()
  })

  test('stages a valid selected file via onAttachmentsChange', ({
    render,
    theme
  }) => {
    const onAttachmentsChange = vi.fn()
    const { container } = render(
      <CommentList
        {...attachmentProps}
        onAttachmentsChange={onAttachmentsChange}
      />,
      [theme]
    )
    const input = container.querySelector(
      '[data-test="comment-attachment-input"]'
    )
    const file = new File(['x'], 'note.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(onAttachmentsChange).toHaveBeenCalledWith([file])
  })

  test('does not render the attach input when attachments are disabled', ({
    render,
    theme
  }) => {
    const { container } = render(
      <CommentList {...attachmentProps} enableAttachments={false} />,
      [theme]
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

  test('only shows the edit link for the original author when the user is not an admin', ({
    render,
    theme
  }) => {
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

    render(<CommentList {...props} />, [theme])

    const editLinks = screen.getAllByTestId('comment-edit-link')
    // Only the author's own comment should expose an edit affordance.
    expect(editLinks).toHaveLength(1)
  })

  test('shows the edit link on every comment when the user has the Administrator role', ({
    render,
    theme
  }) => {
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

    render(<CommentList {...props} />, [theme])

    const editLinks = screen.getAllByTestId('comment-edit-link')
    // Admin can edit every comment regardless of author.
    expect(editLinks).toHaveLength(2)
  })

  test("does not show the edit link on other users' comments when the user only has the System Admin role", ({
    render,
    theme
  }) => {
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

    render(<CommentList {...props} />, [theme])

    expect(screen.queryAllByTestId('comment-edit-link')).toHaveLength(0)
  })

  test("shows the editor name on the edited indicator when an admin edited another user's comment", ({
    render,
    theme
  }) => {
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

    render(<CommentList {...props} />, [theme])

    const indicator = screen.getByTestId('comment-edited-indicator')
    expect(indicator.textContent).toContain('Edited by Admin User')
  })

  test('shows the plain "Edited" indicator when the author edited their own comment', ({
    render,
    theme
  }) => {
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

    render(<CommentList {...props} />, [theme])

    const indicator = screen.getByTestId('comment-edited-indicator')
    expect(indicator.textContent).toBe('Edited')
  })
})
