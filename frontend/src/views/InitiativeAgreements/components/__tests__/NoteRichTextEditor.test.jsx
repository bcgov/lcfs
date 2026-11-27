import 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, vi } from 'vite-plus/test'

import { NoteRichTextEditor } from '../NoteRichTextEditor'
import { test } from '@/tests/utils/fixtures'

const setAttribute = vi.fn()
vi.mock('react-quill-new', async () => {
  const React = await import('react')
  const MockQuill = React.forwardRef(function MockQuill(
    { value, onChange, readOnly, modules, formats },
    ref
  ) {
    React.useImperativeHandle(ref, () => ({
      getEditor: () => ({ root: { setAttribute } })
    }))
    return (
      <textarea
        data-test="quill"
        value={value}
        readOnly={readOnly}
        data-toolbar={JSON.stringify(modules.toolbar)}
        data-formats={JSON.stringify(formats)}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  })
  return { default: MockQuill }
})

describe('NoteRichTextEditor', () => {
  test('offers the mockup toolbar and nothing that could not be stored', ({
    render
  }) => {
    render(<NoteRichTextEditor value="" onChange={vi.fn()} label="Note" />)

    expect(JSON.parse(screen.getByTestId('quill').dataset.toolbar)).toEqual([
      ['bold', 'italic'],
      [{ list: 'bullet' }, { list: 'ordered' }],
      [{ indent: '-1' }, { indent: '+1' }],
      ['link']
    ])
    expect(JSON.parse(screen.getByTestId('quill').dataset.formats)).toEqual([
      'bold',
      'italic',
      'list',
      'indent',
      'link'
    ])
  })

  test('labels the editable area and reports changes unchanged', ({
    render
  }) => {
    const onChange = vi.fn()
    render(<NoteRichTextEditor value="" onChange={onChange} label="Note" />)

    expect(setAttribute).toHaveBeenCalledWith('aria-label', 'Note')
    fireEvent.change(screen.getByTestId('quill'), {
      target: { value: '<p>Hi</p>' }
    })
    expect(onChange).toHaveBeenCalledWith('<p>Hi</p>')
  })

  test('is read-only while disabled', ({ render }) => {
    render(
      <NoteRichTextEditor value="" onChange={vi.fn()} label="Note" disabled />
    )

    expect(screen.getByTestId('quill')).toHaveAttribute('readonly')
  })
})
