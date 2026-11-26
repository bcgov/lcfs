import { useEffect, useRef } from 'react'
import ReactQuill from 'react-quill-new'
import '@dotwee/quill/dist/quill.snow.css'

import BCBox from '@/components/BCBox'

const NOTE_MODULES = {
  toolbar: [
    ['bold', 'italic'],
    [{ list: 'bullet' }, { list: 'ordered' }],
    [{ indent: '-1' }, { indent: '+1' }],
    ['link']
  ],
  keyboard: { bindings: { tab: false } }
}

const NOTE_FORMATS = ['bold', 'italic', 'list', 'indent', 'link']

// Emits the editor's HTML unchanged: rewriting it on every keystroke would
// reset the cursor. The form sanitizes on save and the server again on store.
export const NoteRichTextEditor = ({
  value,
  onChange,
  disabled = false,
  label,
  testId = 'note-editor'
}) => {
  const quillRef = useRef(null)

  // Quill builds its own contenteditable, so the accessible name is set on it.
  useEffect(() => {
    if (label) {
      quillRef.current?.getEditor?.().root.setAttribute('aria-label', label)
    }
  }, [label])

  return (
    <BCBox
      data-test={testId}
      sx={{
        '& .ql-editor': {
          minHeight: '8rem',
          maxHeight: '28rem',
          fontFamily: (theme) => theme.typography.body4.fontFamily,
          fontSize: (theme) => theme.typography.body4.fontSize,
          lineHeight: (theme) => theme.typography.body4.lineHeight
        }
      }}
    >
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={NOTE_MODULES}
        formats={NOTE_FORMATS}
        readOnly={disabled}
      />
    </BCBox>
  )
}
