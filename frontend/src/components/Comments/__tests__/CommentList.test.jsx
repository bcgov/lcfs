import { fireEvent, render, screen } from '@testing-library/react'
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
    t: (key) => {
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
        'internalComment:publicComments': 'Public comments'
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

  it('does not render filter tabs for BCeID dual-mode users', () => {
    mockUserState.roles = [roles.ci_applicant]

    render(<CommentList {...baseProps} />, { wrapper })

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
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
