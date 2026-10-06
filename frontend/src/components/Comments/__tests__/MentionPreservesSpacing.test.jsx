import { test } from '@/tests/utils/fixtures'
import { screen, fireEvent, waitFor, act } from '@testing-library/react'
import ReactQuill from 'react-quill'
import { describe, vi, beforeAll, expect } from 'vitest'
import { useState } from 'react'
import CommentForm from '../CommentForm'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

// jsdom doesn't implement range layout geometry; Quill's setSelection calls
// scrollIntoView, which needs these to exist (real browsers obviously do).
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

const { Quill } = ReactQuill

const mentionableUsers = [
  { userProfileId: 1, displayName: 'Jane Doe', email: 'jane.doe@gov.bc.ca' }
]

// Properly controlled, like the real Comments/CommentList wiring — a no-op
// onChange would desync `commentText` from Quill's live content and cause
// react-quill to re-parse/trim on every re-render, which isn't realistic.
const ControlledCommentForm = () => {
  const [commentText, setCommentText] = useState('Hello ')
  return (
    <CommentForm
      title="New internal comment"
      commentText={commentText}
      onCommentChange={setCommentText}
      onSubmit={() => {}}
      enableMentions
      mentionResults={{ data: mentionableUsers, isFetching: false }}
      onMentionQueryChange={() => {}}
    />
  )
}

const SECOND_USER = [
  { userProfileId: 2, displayName: 'Al Ring', email: 'al.ring@gov.bc.ca' }
]

const ChainedMentionsForm = () => {
  const [commentText, setCommentText] = useState(
    '<p>test <span class="mention" data-mention-id="1" ' +
      'data-mention-name="Jane Doe">@Jane Doe</span></p>'
  )
  return (
    <CommentForm
      title="New internal comment"
      commentText={commentText}
      onCommentChange={setCommentText}
      onSubmit={() => {}}
      enableMentions
      mentionResults={{ data: SECOND_USER, isFetching: false }}
      onMentionQueryChange={() => {}}
    />
  )
}

describe('Typing a mention after an existing mention', () => {
  test('keeps the text typed before the new "@" (no eaten space/letters)', async ({
    render,
    theme
  }) => {
    render(<ChainedMentionsForm />, [theme])
    const quill = Quill.find(document.querySelector('.ql-container'))
    quill.focus()

    // Typed one chunk at a time, like a real user.
    for (const chunk of [' and ', '@', 'Al']) {
      await act(async () => {
        quill.insertText(quill.getLength() - 1, chunk, 'user')
        quill.setSelection(quill.getLength() - 1, 0, 'user')
      })
    }

    fireEvent.click(await screen.findByRole('option'))
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    const visibleText = document
      .querySelector('.ql-editor')
      .textContent.replace(/\uFEFF/g, '')
    expect(visibleText).toBe('test @Jane Doe and @Al Ring ')
  })
})

describe('Mention button preserves surrounding text', () => {
  test('clicking the mention button appends "@" after existing text, keeping the preceding space', async ({
    render,
    theme
  }) => {
    render(<ControlledCommentForm />, [theme])

    const editor = document.querySelector('.ql-editor')

    // Simulate the user having already clicked into the editor and placed
    // the caret at the end of "Hello" (jsdom has no real layout/click-to-
    // caret behaviour, so the native Selection API is driven directly).
    const textNode = editor.querySelector('p').firstChild
    const range = document.createRange()
    range.setStart(textNode, textNode.length)
    range.collapse(true)
    const domSelection = document.getSelection()
    domSelection.removeAllRanges()
    domSelection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'internalComment:mentionButtonLabel'
      })
    )

    const option = await screen.findByRole('option')
    fireEvent.click(option)

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    // Quill pads atomic embeds with invisible zero-width guard characters;
    // strip those before asserting on the visible text.
    const visibleText = editor.textContent.replace(/\uFEFF/g, '')
    expect(visibleText).toBe('Hello @Jane Doe ')
  })
})
