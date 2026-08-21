import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { wrapper } from '@/tests/utils/wrapper'
import { CommentRow } from '../CommentRow'

vi.mock('@/components/Comments/CommentForm', () => ({
  default: () => <div data-test="comment-form" />
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
  it('highlights every matching occurrence across returned comments', () => {
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
      { wrapper }
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
