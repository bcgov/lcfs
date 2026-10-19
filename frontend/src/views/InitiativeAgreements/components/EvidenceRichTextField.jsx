import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import EditIcon from '@mui/icons-material/Edit'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'

import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import DocumentPreviewDialog from '@/components/Documents/DocumentPreviewDialog'
import { DOCUMENT_FILE_TYPES, MAX_FILE_SIZE_BYTES } from '@/constants/common'
import { useFolderUpload } from '@/hooks/useDocumentFolders'
import { validateFile } from '@/utils/fileValidation'
import { quillAttachIcon } from '@/utils/quillAttachIcon'
import { evidenceEditorHtml, evidencePlainText } from './evidenceRichText'

ReactQuill.Quill.import('ui/icons').attach = quillAttachIcon

const EVIDENCE_MODULES = {
  toolbar: [
    [{ size: [false, 'small', 'large'] }],
    ['bold', 'italic'],
    [{ align: [false, 'center', 'right'] }],
    [{ list: 'bullet' }, { list: 'ordered' }],
    [{ indent: '-1' }, { indent: '+1' }],
    ['link', 'attach']
  ],
  keyboard: { bindings: { tab: false } }
}

const EVIDENCE_FORMATS = [
  'size',
  'bold',
  'italic',
  'align',
  'list',
  'bullet',
  'indent',
  'link'
]

export const EvidenceRichTextField = ({
  designatedActionId,
  field,
  label,
  testId,
  canEdit,
  locked,
  allowPencil = true,
  required = false,
  inline = false,
  placeholder
}) => {
  const { t } = useTranslation(['common'])
  const editorRef = useRef(null)
  const { mutateAsync: uploadFiles } = useFolderUpload(
    'designatedAction',
    designatedActionId
  )
  const [previewDocument, setPreviewDocument] = useState(null)
  const fileInputRef = useRef(null)
  const attachmentRange = useRef(null)
  const choosingFile = useRef(false)
  const uploadingRef = useRef(false)
  const [uploading, setUploading] = useState(false)
  const focusOnEdit = useRef(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(field.value ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const editingRef = useRef(false)
  editingRef.current = editing
  const focused = useRef(false)
  const readOnly =
    !canEdit ||
    Boolean(locked && !(allowPencil && editing)) ||
    saving ||
    uploading
  const readOnlyRef = useRef(readOnly)
  readOnlyRef.current = readOnly

  const updateValue = (value) => {
    if (inline) field.onChange({ target: { value } })
    else setDraft(value)
  }

  const chooseAttachment = useCallback(() => {
    if (readOnlyRef.current) return
    attachmentRange.current = editorRef.current.getEditor().getSelection(true)
    choosingFile.current = true
    fileInputRef.current.click()
  }, [])
  const modules = useMemo(
    () => ({
      ...EVIDENCE_MODULES,
      toolbar: {
        container: EVIDENCE_MODULES.toolbar,
        handlers: { attach: chooseAttachment }
      }
    }),
    [chooseAttachment]
  )

  useEffect(() => {
    const input = fileInputRef.current
    const cancel = () => {
      choosingFile.current = false
      editorRef.current?.focus()
    }
    input.addEventListener('cancel', cancel)
    return () => input.removeEventListener('cancel', cancel)
  }, [])

  const attachFiles = async (event) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    choosingFile.current = false
    if (!files.length || readOnlyRef.current) return
    const rejected = files
      .map((file) => {
        const result = validateFile(
          file,
          MAX_FILE_SIZE_BYTES,
          DOCUMENT_FILE_TYPES
        )
        return result.isValid ? null : `${file.name}: ${result.errorMessage}`
      })
      .filter(Boolean)
    if (rejected.length) {
      setError(rejected.join('\n'))
      editorRef.current?.focus()
      return
    }
    setError('')
    uploadingRef.current = true
    setUploading(true)
    const editor = editorRef.current.getEditor()
    let index =
      attachmentRange.current?.index ?? Math.max(0, editor.getLength() - 1)
    try {
      for (const file of files) {
        const ids = await uploadFiles({ files: [file], folderId: null })
        const id = ids[0]
        if (!Number.isInteger(id))
          throw new Error(
            t('initiativeAgreement:evidence.attachmentUploadFailed')
          )
        editor.insertText(
          index,
          file.name,
          'link',
          `#eoc-document-${id}`,
          'api'
        )
        index += file.name.length
        editor.insertText(index, ' ', { link: false }, 'api')
        index += 1
        const html = editor.root.innerHTML
        updateValue(html)
      }
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          t('initiativeAgreement:evidence.attachmentUploadFailed')
      )
    } finally {
      uploadingRef.current = false
      setUploading(false)
      focusOnEdit.current = true
    }
  }

  useEffect(() => {
    if (!uploading && focusOnEdit.current) {
      editorRef.current?.focus()
      focusOnEdit.current = false
    }
  }, [uploading, editing])

  useEffect(() => {
    if (!focused.current && !editingRef.current) setDraft(field.value ?? '')
  }, [field.value])

  useEffect(() => {
    setEditing(false)
  }, [locked, canEdit, inline])

  useEffect(() => {
    const editor = editorRef.current?.getEditor()
    if (!editor) return
    editor.root.setAttribute('role', 'textbox')
    editor.root.setAttribute('aria-label', label)
    editor.root.setAttribute('aria-multiline', 'true')
    editor.root.setAttribute('aria-readonly', String(readOnly))
    editor.root.setAttribute('data-test', testId)
    const toolbar = editorRef.current
      .getEditor()
      .getModule('toolbar')?.container
    toolbar?.setAttribute('role', 'toolbar')
    toolbar?.setAttribute('aria-label', label)
    toolbar?.querySelectorAll('button').forEach((button) => {
      const format = button.className.replace('ql-', '')
      button.setAttribute(
        'aria-label',
        format === 'attach'
          ? t('internalComment:attachFile')
          : `${format} ${button.value || ''}`.trim()
      )
      if (format === 'attach') button.removeAttribute('aria-pressed')
    })
  }, [label, readOnly, testId, t])

  return (
    <BCBox sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <BCTypography variant="body4" color="primary" sx={{ fontWeight: 700 }}>
          {label}
        </BCTypography>
        {canEdit && locked && allowPencil && !inline && !editing && (
          <IconButton
            size="small"
            color="primary"
            aria-label={`${t('common:editBtn')} ${label}`}
            title={t('common:editBtn')}
            data-test={`${testId}-edit`}
            onClick={() => {
              setDraft(field.value ?? '')
              setError('')
              focusOnEdit.current = true
              setEditing(true)
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      {error && (
        <BCAlert severity="error" dismissible={false}>
          {error}
        </BCAlert>
      )}
      <Box
        onClickCapture={(event) => {
          const anchor = event.target.closest('a[href^="#eoc-document-"]')
          if (!anchor) return
          event.preventDefault()
          event.stopPropagation()
          const match = /^#eoc-document-(\d+)$/.exec(
            anchor.getAttribute('href')
          )
          if (!match) return
          setPreviewDocument({
            documentId: Number(match[1]),
            fileName: anchor.textContent
          })
        }}
        onFocusCapture={() => {
          focused.current = true
        }}
        onBlurCapture={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) return
          if (choosingFile.current || uploadingRef.current) return
          focused.current = false
          if (inline || readOnly) return
          if (required && !evidencePlainText(draft)) {
            setDraft(field.value ?? '')
            setEditing(false)
            return
          }
          if (draft === (field.value ?? '')) {
            setEditing(false)
            return
          }
          setSaving(true)
          setError('')
          field.onSave(draft, {
            onSuccess: () => {
              setSaving(false)
              setEditing(false)
            },
            onError: (err) => {
              setSaving(false)
              setError(
                err?.response?.data?.detail ||
                  err?.message ||
                  t('initiativeAgreement:workflow.actionFailed')
              )
            }
          })
        }}
        sx={{
          '& .ql-toolbar': { display: readOnly ? 'none' : 'block' },
          '& .ql-container': {
            fontFamily: 'inherit',
            fontSize: '1rem',
            ...(readOnly && { border: 'none !important' })
          },
          '& .ql-editor': { minHeight: 75, maxHeight: 1000, overflowY: 'auto' }
        }}
      >
        <ReactQuill
          ref={editorRef}
          theme="snow"
          value={evidenceEditorHtml(
            inline || (readOnly && !saving && !uploading) ? field.value : draft
          )}
          readOnly={readOnly}
          modules={modules}
          formats={EVIDENCE_FORMATS}
          placeholder={readOnly ? '' : placeholder}
          onChange={(html, _delta, source) => {
            if (source === 'user' && !readOnly) {
              const value = evidencePlainText(html) ? html : ''
              updateValue(value)
            }
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          accept={DOCUMENT_FILE_TYPES.ACCEPT_STRING}
          data-test={`${testId}-attach-input`}
          onChange={attachFiles}
        />
        {uploading && (
          <Loading
            message={t('initiativeAgreement:evidence.attachmentUploading')}
          />
        )}
      </Box>
      {previewDocument && (
        <DocumentPreviewDialog
          open
          onClose={() => setPreviewDocument(null)}
          parentType="designatedAction"
          parentID={designatedActionId}
          document={previewDocument}
        />
      )}
    </BCBox>
  )
}
