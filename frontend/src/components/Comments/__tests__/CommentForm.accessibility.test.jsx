import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, vi } from 'vitest'
import { test } from '@/tests/utils/fixtures'
import CommentForm from '../CommentForm'

const defaultProps = {
  title: 'Add a comment',
  commentText: '',
  onSubmit: vi.fn(),
  showAddCommentBtn: false
}

const getToolbar = (container) => container.querySelector('.ql-toolbar')
const getQuill = (container) =>
  container.querySelector('.ql-container')?.__quill

describe('CommentForm Quill toolbar accessibility', () => {
  beforeEach(() => {
    // Quill focuses the editor before applying toolbar actions. jsdom does not
    // implement these layout APIs, so return an empty rectangle for that path.
    Range.prototype.getBoundingClientRect ??= () => ({
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0
    })
    Range.prototype.getClientRects ??= () => []
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('names the generated formatting controls and exposes their pressed state', ({
    render,
    theme
  }) => {
    const { container } = render(<CommentForm {...defaultProps} />, [theme])

    expect(
      screen.getByRole('toolbar', { name: 'Comment formatting' })
    ).toBeInTheDocument()

    const controlNames = ['Bold', 'Italic', 'Bulleted list', 'Numbered list']
    controlNames.forEach((name) => {
      expect(screen.getByRole('button', { name })).toHaveAttribute(
        'aria-pressed',
        'false'
      )
    })
    const attach = getToolbar(container)?.querySelector('.ql-attach')
    expect(attach?.closest('.ql-formats')).toHaveAttribute('hidden')
    expect(attach?.closest('.ql-formats')).toHaveStyle({ display: 'none' })
    expect(attach).toHaveAttribute('hidden')
    expect(attach).toBeDisabled()
    expect(attach).toHaveStyle({ display: 'none' })
    expect(screen.queryByRole('button', { name: 'Attach file' })).toBeNull()
  })

  test('updates pressed state after keyboard formatting and editor selection changes', async ({
    render,
    theme
  }) => {
    const user = userEvent.setup()
    const { container } = render(<CommentForm {...defaultProps} />, [theme])
    const quill = getQuill(container)
    const bold = screen.getByRole('button', { name: 'Bold' })

    act(() => {
      quill.setText('bold plain', 'silent')
      quill.setSelection(0, 4, 'silent')
    })

    bold.focus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(bold).toHaveAttribute('aria-pressed', 'true'))
    expect(quill.getFormat(0, 4).bold).toBe(true)

    act(() => quill.setSelection(5, 5, 'silent'))
    await waitFor(() => expect(bold).toHaveAttribute('aria-pressed', 'false'))
    expect(quill.getFormat(5, 5).bold).toBeUndefined()

    const bulletList = screen.getByRole('button', { name: 'Bulleted list' })
    bulletList.focus()
    await user.keyboard(' ')
    await waitFor(() =>
      expect(bulletList).toHaveAttribute('aria-pressed', 'true')
    )
    expect(quill.getFormat(5, 5).list).toBe('bullet')

    const numberedList = screen.getByRole('button', { name: 'Numbered list' })
    numberedList.focus()
    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(numberedList).toHaveAttribute('aria-pressed', 'true')
      expect(bulletList).toHaveAttribute('aria-pressed', 'false')
    })
    expect(quill.getFormat(5, 5).list).toBe('ordered')
  })

  test('rebinds accessibility after visibility remounts and attachment availability changes', ({
    render,
    theme
  }) => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
    const { container, rerender, unmount } = render(
      <CommentForm
        {...defaultProps}
        showVisibilityToggle
        visibility="Internal"
      />,
      [theme]
    )
    const internalToolbar = getToolbar(container)

    rerender(
      <CommentForm {...defaultProps} showVisibilityToggle visibility="Public" />
    )

    const publicToolbar = getToolbar(container)
    expect(publicToolbar).not.toBe(internalToolbar)
    expect(
      screen.getByRole('toolbar', { name: 'Comment formatting' })
    ).toBeInTheDocument()
    expect(disconnect).toHaveBeenCalledTimes(1)

    rerender(
      <CommentForm
        {...defaultProps}
        showVisibilityToggle
        visibility="Public"
        enableAttachments
        onAttachmentsChange={vi.fn()}
      />
    )

    const attach = screen.getByRole('button', { name: 'Attach file' })
    expect(attach).toBeInTheDocument()
    expect(attach).not.toHaveAttribute('aria-pressed')
    expect(getToolbar(container)).toBe(publicToolbar)
    expect(disconnect).toHaveBeenCalledTimes(2)

    rerender(
      <CommentForm {...defaultProps} showVisibilityToggle visibility="Public" />
    )
    expect(screen.queryByRole('button', { name: 'Attach file' })).toBeNull()
    expect(getToolbar(container)).toBe(publicToolbar)
    expect(disconnect).toHaveBeenCalledTimes(3)

    unmount()
    expect(disconnect).toHaveBeenCalledTimes(4)
  })

  test('preserves the real Quill editor, selection, content, and undo when attachments toggle', async ({
    render,
    theme
  }) => {
    const user = userEvent.setup()
    const onAttachmentsChange = vi.fn()
    const StatefulCommentForm = ({ enableAttachments }) => {
      const [commentText, setCommentText] = useState('')
      return (
        <CommentForm
          {...defaultProps}
          commentText={commentText}
          onCommentChange={setCommentText}
          enableAttachments={enableAttachments}
          onAttachmentsChange={onAttachmentsChange}
        />
      )
    }

    const { container, rerender } = render(
      <StatefulCommentForm enableAttachments={false} />,
      [theme]
    )
    const quill = getQuill(container)
    const toolbar = getToolbar(container)
    const root = quill.root
    const history = quill.getModule('history')
    const fileInputClick = vi.spyOn(HTMLInputElement.prototype, 'click')

    act(() => {
      history.clear()
      quill.insertText(0, 'before', 'user')
      history.cutoff()
      quill.insertText(6, ' after', 'user')
      history.cutoff()
      quill.setSelection(3, 2, 'silent')
    })

    const contentsAfterEdit = quill.getContents()
    const selectionAfterEdit = quill.getSelection()
    expect(quill.getText()).toBe('before after\n')
    expect(selectionAfterEdit).toEqual({ index: 3, length: 2 })

    rerender(<StatefulCommentForm enableAttachments />)

    expect(getQuill(container)).toBe(quill)
    expect(quill.root).toBe(root)
    expect(root.isConnected).toBe(true)
    expect(getToolbar(container)).toBe(toolbar)
    expect(quill.getContents()).toEqual(contentsAfterEdit)
    expect(quill.getSelection()).toEqual(selectionAfterEdit)
    expect(
      screen.getByRole('button', { name: 'Attach file' })
    ).toBeInTheDocument()
    expect(
      toolbar?.querySelector('.ql-attach')?.closest('.ql-formats')
    ).not.toHaveAttribute('hidden')

    await user.click(screen.getByRole('button', { name: 'Attach file' }))
    expect(fileInputClick).toHaveBeenCalledTimes(1)
    act(() => quill.setSelection(3, 2, 'silent'))
    const contentsBeforeDisable = quill.getContents()
    const selectionBeforeDisable = quill.getSelection()

    rerender(<StatefulCommentForm enableAttachments={false} />)

    expect(getQuill(container)).toBe(quill)
    expect(quill.root.isConnected).toBe(true)
    expect(getToolbar(container)).toBe(toolbar)
    expect(quill.getContents()).toEqual(contentsBeforeDisable)
    expect(quill.getSelection()).toEqual(selectionBeforeDisable)
    expect(screen.queryByRole('button', { name: 'Attach file' })).toBeNull()
    const toolbarModule = quill.getModule('toolbar')
    act(() => toolbarModule.handlers.attach.call(toolbarModule))
    expect(fileInputClick).toHaveBeenCalledTimes(1)

    act(() => history.undo())
    expect(quill.getText()).toBe('before\n')
  })
})
