import { useState } from 'react'
import type { ButtonProps } from '@mui/material/Button'
import { useTranslation } from 'react-i18next'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Visibility from '@mui/icons-material/Visibility'

import DocumentPreviewDialog from '@/components/Documents/DocumentPreviewDialog'
import { getDocumentDisplayName, isDocumentLocked } from '@/utils/documents'
import type { DocumentPreviewMetadata } from '@/types/documents'

interface DocumentPreviewButtonProps {
  parentType: string
  parentID: number | string
  document: DocumentPreviewMetadata
  size?: ButtonProps['size']
}

const DocumentPreviewButton = ({
  parentType,
  parentID,
  document,
  size = 'small'
}: DocumentPreviewButtonProps) => {
  const { t } = useTranslation(['report'])
  const [open, setOpen] = useState(false)
  const fileName = getDocumentDisplayName(document || {})

  if (!document?.documentId || parentID == null || !parentType) {
    return null
  }

  // A macro-enabled workbook can't be opened until it's approved
  if (isDocumentLocked(document)) {
    return (
      <Tooltip title={t('report:documentScan.lockedTooltip')}>
        <span>
          <IconButton
            aria-label={`Preview ${fileName}`}
            size={size}
            disabled
            data-test="document-preview-button"
          >
            <Visibility fontSize="inherit" />
          </IconButton>
        </span>
      </Tooltip>
    )
  }

  return (
    <>
      <Tooltip title={`Preview ${fileName}`}>
        <IconButton
          aria-label={`Preview ${fileName}`}
          size={size}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setOpen(true)
          }}
          data-test="document-preview-button"
        >
          <Visibility fontSize="inherit" />
        </IconButton>
      </Tooltip>
      {open && (
        <DocumentPreviewDialog
          open={open}
          onClose={() => setOpen(false)}
          parentType={parentType}
          parentID={parentID}
          document={document}
        />
      )}
    </>
  )
}

export default DocumentPreviewButton
