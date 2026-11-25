import { test } from '@/tests/utils/fixtures'
import { act, fireEvent, screen } from '@testing-library/react'
import ReactQuill from 'react-quill'
import { beforeAll, expect, vi } from 'vite-plus/test'
import { useState } from 'react'
import CommentForm from '../CommentForm'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

beforeAll(() => {
  const rect = new DOMRect(0, 0, 0, 0)
  Range.prototype.getBoundingClientRect = () => rect
  Range.prototype.getClientRects = () => {
    const rects: DOMRect[] = []
    return {
      length: rects.length,
      item: (index: number) => rects[index] ?? null,
      [Symbol.iterator]: () => rects[Symbol.iterator]()
    }
  }
})

const Harness = ({
  initialVisibility = 'Internal'
}: {
  initialVisibility?: 'Internal' | 'Public'
}) => {
  const [text, setText] = useState('')
  const [visibility, setVisibility] = useState<string>(initialVisibility)
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

const focusCases: Array<['Internal' | 'Public', string]> = [
  ['Internal', 'a'],
  ['Internal', '@'],
  ['Public', 'a']
]

const getQuill = (container: Element | null) => {
  if (!container) throw new Error('Expected a mounted Quill container')
  const quill = ReactQuill.Quill.find(container)
  if (!quill || !('getSelection' in quill)) {
    throw new Error('Expected the mounted Quill editor instance')
  }
  return quill
}

test.for(focusCases)(
  'preserves focus when starting an empty %s comment with %s',
  async ([visibility, character], { render, theme }) => {
    render(<Harness initialVisibility={visibility} />, [theme])
    const originalEditor = document.querySelector('.ql-editor')
    const quill = getQuill(document.querySelector('.ql-container'))
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
  const quill = getQuill(document.querySelector('.ql-container'))

  fireEvent.click(
    screen.getByRole('button', { name: 'internalComment:public' })
  )
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
