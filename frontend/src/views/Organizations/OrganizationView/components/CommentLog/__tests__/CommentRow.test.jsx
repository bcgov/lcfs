import { test } from '@/tests/utils/fixtures'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, vi } from 'vitest'

import { CommentRow } from '../CommentRow'

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
