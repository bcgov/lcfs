import { useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import ReactQuill from 'react-quill'
import { useTranslation } from 'react-i18next'
import BCTypography from '@/components/BCTypography'
import { evidencePlainText } from './evidenceRichText'
import { EOC_RESPONSE_FIELDS } from './EOCResponseFields'

const applyEditorAccessibility = (editorRef, fieldLabel, readOnly) => {
  const editor = editorRef?.getEditor?.()
  if (!editor) return
  const root = editor.root
  root.setAttribute('role', 'textbox')
  root.setAttribute('aria-label', fieldLabel)
  root.setAttribute('aria-multiline', 'true')
  root.setAttribute('aria-readonly', String(readOnly))

  const toolbar = editor.getModule('toolbar')?.container
  if (!toolbar) return
  toolbar.setAttribute('role', 'toolbar')
  toolbar.setAttribute('aria-label', `${fieldLabel} formatting toolbar`)
  toolbar.querySelectorAll('button').forEach((button) => {
    const format = button.className
      .split(/\s+/)
      .find((className) => className.startsWith('ql-'))
      ?.slice(3)
    const labels = {
      bold: 'Bold',
      italic: 'Italic',
      list: button.value === 'ordered' ? 'Numbered list' : 'Bulleted list',
      link: 'Insert link'
    }
    if (format && labels[format])
      button.setAttribute('aria-label', labels[format])
  })
}

/** The shared applicant response fields used on both the BCeID and IDIR pages. */
export const EOCRequirementResponses = ({
  requirement,
  response = {},
  readOnly = false,
  saving = false,
  onChange = () => {}
}) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const editors = useRef({})

  useEffect(() => {
    EOC_RESPONSE_FIELDS.forEach(({ key, labelKey }) => {
      const editorRef = editors.current[key]
      applyEditorAccessibility(editorRef, t(labelKey), readOnly || saving)
    })
  }, [readOnly, saving, t])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {evidencePlainText(requirement?.description) && (
        <BCTypography component="p" variant="body4" sx={{ m: 0 }}>
          {evidencePlainText(requirement.description)}
        </BCTypography>
      )}
      {EOC_RESPONSE_FIELDS.map(({ key, labelKey }) => {
        const label = t(labelKey)
        const labelId = `eoc-response-${requirement.id}-${key}-label`
        return (
          <Box key={key}>
            <BCTypography
              component="label"
              id={labelId}
              variant="body4"
              sx={{
                display: 'block',
                mb: 0.75,
                color: 'primary.main',
                fontWeight: 700
              }}
            >
              {label}
            </BCTypography>
            <ReactQuill
              ref={(editor) => {
                editors.current[key] = editor
              }}
              theme="snow"
              readOnly={readOnly || saving}
              value={response[key] || ''}
              onChange={(value) => {
                if (!readOnly && !saving) onChange(key, value)
              }}
              modules={{
                toolbar: readOnly
                  ? false
                  : [
                      ['bold', 'italic'],
                      [{ list: 'ordered' }, { list: 'bullet' }],
                      ['link']
                    ]
              }}
            />
          </Box>
        )
      })}
    </Box>
  )
}

export default EOCRequirementResponses
