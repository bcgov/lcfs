import { test } from '@/tests/utils/fixtures'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, vi } from 'vitest'
import { useDownloadDocument } from '@/hooks/useDocuments'

import { CommentRow } from '../CommentRow'

vi.unmock('@/components/BCBox')

const downloadDocument = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/useDocuments', () => ({
  useDownloadDocument: vi.fn(() => downloadDocument)
}))

vi.mock('@/components/Documents/DocumentPreviewDialog', () => ({
  default: ({ parentType, parentID, document, onClose }) => (
    <div
      role="dialog"
      aria-label="Document preview"
      data-parent-type={parentType}
      data-parent-id={parentID}
      data-document-id={document.documentId}
    >
      <button onClick={onClose}>Close preview</button>
    </div>
  )
}))

vi.mock('@/components/Comments/CommentForm', () => ({
  default: ({ enableMentions }) => (
    <div data-test="comment-form" data-mentions={String(!!enableMentions)} />
  )
}))

const comment = (id, html) => ({
  internalCommentId: id,
  comment: html,
  visibility: 'Internal',
  createDate: '2026-08-20T12:00:00Z',
  updateDate: '2026-08-20T12:00:00Z',
  fullName: 'Test User',
  canEdit: false
})

describe('CommentRow search highlighting', () => {
  test('highlights every matching occurrence across returned comments', ({
    render,
    app
  }) => {
    render(
      <>
        <CommentRow
          comment={comment(1, '<p>Fuel credit and more fuel</p>')}
          index={0}
          searchQuery="fuel credit"
        />
        <CommentRow
          comment={comment(2, '<p>A CREDIT result</p>')}
          index={1}
          searchQuery="fuel credit"
        />
      </>,
      [...app]
    )

    const bodies = screen.getAllByTestId('comment-body')
    expect(
      [...bodies[0].querySelectorAll('mark')].map((mark) => mark.textContent)
    ).toEqual(['Fuel', 'credit', 'fuel'])
    expect(
      [...bodies[1].querySelectorAll('mark')].map((mark) => mark.textContent)
    ).toEqual(['CREDIT'])
  })
})

describe('CommentRow @mentions while editing', () => {
  const renderEditing = (render, app, props) => {
    render(
      <CommentRow
        comment={{ ...comment(1, '<p>Hello</p>'), canEdit: true }}
        index={0}
        {...props}
      />,
      [...app]
    )
    fireEvent.click(screen.getByTestId('edit-comment-btn'))
    return screen.getByTestId('comment-form')
  }

  test('enables mentions for IDIR users editing an Internal comment', ({
    render,
    app
  }) => {
    const form = renderEditing(render, app, {
      enableMentions: true,
      isGovernmentUser: true
    })
    expect(form).toHaveAttribute('data-mentions', 'true')
  })

  test('keeps mentions off when the caller has not enabled them', ({
    render,
    app
  }) => {
    const form = renderEditing(render, app, { isGovernmentUser: false })
    expect(form).toHaveAttribute('data-mentions', 'false')
  })

  test('keeps mentions off for a Public comment', ({ render, app }) => {
    const form = renderEditing(render, app, {
      enableMentions: true,
      isGovernmentUser: true,
      comment: {
        ...comment(2, '<p>Hello</p>'),
        visibility: 'Public',
        canEdit: true
      }
    })
    expect(form).toHaveAttribute('data-mentions', 'false')
  })
})

describe('CommentRow attachments', () => {
  const attachedComment = {
    ...comment(42, '<p>Payment verified</p>'),
    documents: [
      {
        documentId: 81,
        fileName: 'confirmation.pdf',
        createUser: 'penalty-author',
        createDate: '2026-10-22T12:01:00Z'
      },
      {
        documentId: 82,
        fileName: 'evidence.csv',
        createUser: 'another-author',
        createDate: '2026-10-22T12:02:00Z'
      }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
    downloadDocument.mockReset().mockResolvedValue(undefined)
  })

  test('shows attachments and upload details on a read-only comment, with keyboard preview and download', async ({
    render,
    app
  }) => {
    render(<CommentRow comment={attachedComment} index={0} />, [...app])
    const user = userEvent.setup()
    expect(screen.getByRole('list', { name: 'Attachments' })).toBeVisible()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText(/Uploaded by penalty-author on/)).toHaveTextContent(
      /October 22, 2026/
    )
    expect(screen.getByText(/Uploaded by another-author on/)).toBeVisible()
    expect(screen.queryByTestId('edit-comment-btn')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('comment-attachment-input')
    ).not.toBeInTheDocument()

    screen.getByRole('button', { name: 'Preview confirmation.pdf' }).focus()
    await user.keyboard('{Enter}')
    const preview = screen.getByRole('dialog', { name: 'Document preview' })
    expect(preview).toHaveAttribute('data-parent-type', 'internal_comment')
    expect(preview).toHaveAttribute('data-parent-id', '42')
    expect(preview).toHaveAttribute('data-document-id', '81')
    await user.click(screen.getByRole('button', { name: 'Close preview' }))

    screen
      .getByRole('button', { name: 'Download attachment: confirmation.pdf' })
      .focus()
    await user.keyboard('{Enter}')
    expect(useDownloadDocument).toHaveBeenCalledWith('internal_comment', 42)
    expect(downloadDocument).toHaveBeenCalledWith(81, 'confirmation.pdf')
  })

  test('reports a failed download and lets the user retry', async ({
    render,
    app
  }) => {
    downloadDocument.mockRejectedValueOnce(new Error('Network unavailable'))
    render(<CommentRow comment={attachedComment} index={0} />, [...app])
    const user = userEvent.setup()
    const download = screen.getByRole('button', {
      name: 'Download attachment: confirmation.pdf'
    })
    await user.click(download)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not download attachment. Please try again.'
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Network unavailable')
    await user.click(download)
    await waitFor(() => expect(downloadDocument).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('omits attachment controls and document hooks for comments without files', ({
    render,
    app
  }) => {
    render(<CommentRow comment={comment(1, '<p>No files</p>')} index={0} />, [
      ...app
    ])
    expect(
      screen.queryByRole('list', { name: 'Attachments' })
    ).not.toBeInTheDocument()
    expect(useDownloadDocument).not.toHaveBeenCalled()
  })
})
