import { test } from '@/tests/utils/fixtures'
import { screen, fireEvent } from '@testing-library/react'
import { describe, vi, beforeAll, expect } from 'vitest'
import { useState } from 'react'
import CommentForm from '../CommentForm'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

beforeAll(() => {
  const rect = {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({})
  }
  Range.prototype.getBoundingClientRect = () => rect
  Range.prototype.getClientRects = () => ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* () {}
  })
})

const MENTION_HTML =
  '<p>Hi <span class="mention" data-mention-id="5" ' +
  'data-mention-name="Jane Doe">@Jane Doe</span> there</p>'

const Harness = ({ onSubmit = () => {} }) => {
  const [commentText, setCommentText] = useState(MENTION_HTML)
  const [visibility, setVisibility] = useState('Internal')
  return (
    <CommentForm
      title="Edit comment:"
      commentText={commentText}
      onCommentChange={setCommentText}
      onSubmit={onSubmit}
      isEditing
      enableMentions={visibility === 'Internal'}
      showVisibilityToggle
      visibility={visibility}
      onVisibilityChange={setVisibility}
    />
  )
}

const switchToPublic = () =>
  fireEvent.click(
    screen.getByRole('button', { name: 'internalComment:public' })
  )

describe('Mentions when switching a comment to Public', () => {
  test('does not destroy mentions; asks the user to resolve the conflict', ({
    render,
    theme
  }) => {
    render(<Harness />, [theme])
    switchToPublic()

    expect(document.querySelector('.ql-editor .mention')).not.toBeNull()
    expect(
      document.querySelector('[data-test="comment-mention-conflict"]')
    ).not.toBeNull()
    expect(
      document.querySelector('[data-mention-conflict="true"]')
    ).not.toBeNull()
  })

  test('blocks submit until the conflict is resolved', ({ render, theme }) => {
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />, [theme])
    switchToPublic()

    const submit = screen.getByRole('button', {
      name: 'internalComment:saveChanges'
    })
    expect(submit).toBeDisabled()
    fireEvent.click(submit)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('switching back to Internal is lossless and clears the warning', ({
    render,
    theme
  }) => {
    render(<Harness />, [theme])
    switchToPublic()
    fireEvent.click(screen.getByText('internalComment:keepInternal'))

    expect(document.querySelector('.ql-editor .mention')).not.toBeNull()
    expect(
      document.querySelector('[data-test="comment-mention-conflict"]')
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'internalComment:saveChanges' })
    ).toBeEnabled()
  })

  test('"Remove mentions" deletes them entirely and enables submit', ({
    render,
    theme
  }) => {
    render(<Harness />, [theme])
    switchToPublic()
    fireEvent.click(screen.getByText('internalComment:removeMentions'))

    expect(document.querySelector('.ql-editor .mention')).toBeNull()
    const text = document.querySelector('.ql-editor').textContent
    expect(text).not.toContain('Jane Doe')
    expect(text).toContain('Hi')
    expect(text).toContain('there')
    expect(
      screen.getByRole('button', { name: 'internalComment:saveChanges' })
    ).toBeEnabled()
    expect(
      document.querySelector('[data-test="comment-mentions-removed-notice"]')
    ).not.toBeNull()
  })

  test('Undo restores the mentions and returns to Internal', ({
    render,
    theme
  }) => {
    render(<Harness />, [theme])
    switchToPublic()
    fireEvent.click(screen.getByText('internalComment:removeMentions'))
    fireEvent.click(screen.getByText('internalComment:undo'))

    expect(document.querySelector('.ql-editor .mention')).not.toBeNull()
    expect(
      document.querySelector('[data-test="comment-mentions-removed-notice"]')
    ).toBeNull()
  })

  test('toolbar @ button stays visible but is aria-disabled while Public', ({
    render,
    theme
  }) => {
    render(<Harness />, [theme])
    const button = () => document.querySelector('.ql-toolbar .ql-mention')

    expect(button().getAttribute('aria-disabled')).toBeNull()
    switchToPublic()
    expect(button().style.display).not.toBe('none')
    expect(button().getAttribute('aria-disabled')).toBe('true')
    expect(button().getAttribute('title')).toBe(
      'internalComment:mentionButtonDisabledPublic'
    )
  })

  test('shows the warning above the editor and Undo as a button', ({
    render,
    theme
  }) => {
    render(<Harness />, [theme])
    switchToPublic()

    const editor = document.querySelector('.ql-container')
    const warning = document.querySelector(
      '[data-test="comment-mention-conflict"]'
    )
    expect(
      editor.compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_PRECEDING
    ).toBeTruthy()

    fireEvent.click(screen.getByText('internalComment:removeMentions'))
    expect(
      screen.getByRole('button', { name: 'internalComment:undo' })
    ).toBeInTheDocument()
  })
})
