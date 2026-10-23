import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, vi } from 'vitest'
import { test } from '@/tests/utils/fixtures'
import { MAX_FILE_SIZE_BYTES } from '@/constants/common'
import CommentForm from '../CommentForm'

vi.unmock('@/components/BCBox')

const baseProps = {
  title: 'Add a penalty log comment',
  commentText: '<p>Penalty evidence</p>',
  onCommentChange: vi.fn(),
  onSubmit: vi.fn(),
  enableAttachments: true,
  showUploadDropzone: true
}
const pdf = (name) => new File(['evidence'], name, { type: 'application/pdf' })
const getDropzone = () =>
  screen.getByRole('button', {
    name: 'Upload comment attachments: click to upload or drag and drop'
  })

describe('CommentForm optional upload dropzone', () => {
  test('keeps the normal attachment toolbar when the dropzone is not requested', ({
    render,
    theme,
    i18n
  }) => {
    const { rerender } = render(
      <CommentForm
        {...baseProps}
        showUploadDropzone={false}
        onAttachmentsChange={vi.fn()}
      />,
      [theme, i18n]
    )
    expect(
      screen.queryByTestId('comment-upload-dropzone')
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Attach file' })
    ).toBeInTheDocument()
    rerender(<CommentForm {...baseProps} onAttachmentsChange={vi.fn()} />)
    expect(getDropzone()).toBeInTheDocument()
    rerender(
      <CommentForm
        {...baseProps}
        enableAttachments={false}
        onAttachmentsChange={vi.fn()}
      />
    )
    expect(
      screen.queryByTestId('comment-upload-dropzone')
    ).not.toBeInTheDocument()
  })

  test('opens the existing multiple-file picker by click and keyboard and stages selected files', async ({
    render,
    theme,
    i18n
  }) => {
    const onAttachmentsChange = vi.fn()
    render(
      <CommentForm {...baseProps} onAttachmentsChange={onAttachmentsChange} />,
      [theme, i18n]
    )
    const input = screen.getByTestId('comment-attachment-input')
    const openPicker = vi.spyOn(input, 'click')
    const dropzone = getDropzone()
    await userEvent.click(dropzone)
    dropzone.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(openPicker).toHaveBeenCalledTimes(3)
    expect(input).toHaveAttribute('multiple')
    const files = [pdf('confirmation.pdf'), pdf('invoice.pdf')]
    fireEvent.change(input, { target: { files } })
    expect(onAttachmentsChange).toHaveBeenCalledWith(files)
  })

  test('appends multiple dropped files without losing staged attachments or changing the comment', ({
    render,
    theme,
    i18n
  }) => {
    const existing = pdf('already-staged.pdf')
    const files = [pdf('confirmation.pdf'), pdf('invoice.pdf')]
    const onAttachmentsChange = vi.fn()
    const onCommentChange = vi.fn()
    render(
      <CommentForm
        {...baseProps}
        attachments={[existing]}
        onCommentChange={onCommentChange}
        onAttachmentsChange={onAttachmentsChange}
      />,
      [theme, i18n]
    )
    const dataTransfer = { files, dropEffect: 'none' }
    fireEvent.dragOver(getDropzone(), { dataTransfer })
    expect(dataTransfer.dropEffect).toBe('copy')
    expect(fireEvent.drop(getDropzone(), { dataTransfer })).toBe(false)
    expect(onAttachmentsChange).toHaveBeenCalledWith([existing, ...files])
    expect(onCommentChange).not.toHaveBeenCalled()
  })

  test('applies the existing file-type and size validation to dropped documents', ({
    render,
    theme,
    i18n
  }) => {
    const invalidType = new File(['invalid'], 'program.exe', {
      type: 'application/x-msdownload'
    })
    const oversized = pdf('oversized.pdf')
    Object.defineProperty(oversized, 'size', { value: MAX_FILE_SIZE_BYTES + 1 })
    const accepted = pdf('confirmation.pdf')
    const onAttachmentsChange = vi.fn()
    render(
      <CommentForm {...baseProps} onAttachmentsChange={onAttachmentsChange} />,
      [theme, i18n]
    )
    fireEvent.drop(getDropzone(), {
      dataTransfer: { files: [invalidType, oversized, accepted] }
    })
    expect(onAttachmentsChange).toHaveBeenCalledWith([accepted])
    expect(screen.getByRole('alert')).toHaveTextContent('program.exe')
    expect(screen.getByRole('alert')).toHaveTextContent('50 MB')
  })

  test('blocks dropped documents while the comment is saving', ({
    render,
    theme,
    i18n
  }) => {
    const onAttachmentsChange = vi.fn()
    render(
      <CommentForm
        {...baseProps}
        isSubmitting
        isEditing
        onAttachmentsChange={onAttachmentsChange}
      />,
      [theme, i18n]
    )
    expect(getDropzone()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Attach file' })).toBeDisabled()
    expect(screen.getByTestId('comment-attachment-input')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(document.querySelector('.ql-editor')).toHaveAttribute(
      'contenteditable',
      'false'
    )
    fireEvent.drop(getDropzone(), {
      dataTransfer: { files: [pdf('confirmation.pdf')] }
    })
    expect(onAttachmentsChange).not.toHaveBeenCalled()
  })
})
