import { test } from '@/tests/utils/fixtures'
import { act, fireEvent, screen } from '@testing-library/react'
import ReactQuill from 'react-quill'
import { beforeAll, expect, vi } from 'vitest'
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
    height: 0
  }
  Range.prototype.getBoundingClientRect = () => rect
  Range.prototype.getClientRects = () => []
})

const Harness = ({ initialVisibility = 'Internal' }) => {
  const [text, setText] = useState('')
  const [visibility, setVisibility] = useState(initialVisibility)
  return (
    <CommentForm
      title="Comment"
      commentText={text}
      onCommentChange={setText}
      onSubmit={() => {}}
      showVisibilityToggle
      visibility={visibility}
      onVisibilityChange={setVisibility}
      enableMentions={visibility === 'Internal'}
    />
  )
}

test.for([
  ['Internal', 'a'],
  ['Internal', '@'],
  ['Public', 'a']
])(
  'preserves focus when starting an empty %s comment with %s',
  async ([visibility, character], { render, theme }) => {
    render(<Harness initialVisibility={visibility} />, [theme])
    const originalEditor = document.querySelector('.ql-editor')
    const quill = ReactQuill.Quill.find(document.querySelector('.ql-container'))
    quill.focus()

    await act(async () => {
      quill.insertText(0, character, 'user')
      quill.setSelection(1, 0, 'user')
    })

    expect(document.querySelector('.ql-editor')).toBe(originalEditor)
    expect(document.activeElement).toBe(originalEditor)
    expect(quill.getSelection()).toMatchObject({ index: 1, length: 0 })
  }
)

test('updates the placeholder without replacing the editor or its content', async ({
  render,
  theme
}) => {
  render(<Harness />, [theme])
  const editor = document.querySelector('.ql-editor')
  const quill = ReactQuill.Quill.find(document.querySelector('.ql-container'))

  fireEvent.click(screen.getByRole('button', { name: 'internalComment:public' }))
  expect(document.querySelector('.ql-editor')).toBe(editor)
  expect(editor).toHaveAttribute(
    'data-placeholder',
    'internalComment:publicCommentPlaceholder'
  )

  await act(async () => {
    quill.insertText(0, 'Hello   ', 'user')
    quill.setSelection(5, 0, 'user')
  })
  const contents = quill.getContents()
  const selection = quill.getSelection()

  fireEvent.click(
    screen.getByRole('button', { name: 'internalComment:internalOnly' })
  )
  expect(document.querySelector('.ql-editor')).toBe(editor)
  expect(editor).toHaveAttribute(
    'data-placeholder',
    'internalComment:internalCommentPlaceholder'
  )
  expect(quill.getContents()).toEqual(contents)
  expect(quill.getSelection()).toEqual(selection)
})
