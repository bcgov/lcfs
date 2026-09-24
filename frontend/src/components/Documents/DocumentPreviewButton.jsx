import { useState } from 'react'
import PropTypes from 'prop-types'
import { IconButton, Tooltip } from '@mui/material'
import { Visibility } from '@mui/icons-material'

import DocumentPreviewDialog from '@/components/Documents/DocumentPreviewDialog'
import { getDocumentDisplayName } from '@/utils/documents'

const DocumentPreviewButton = ({
  parentType,
  parentID,
  document,
  size = 'small'
}) => {
  const [open, setOpen] = useState(false)
  const fileName = getDocumentDisplayName(document || {})

  if (!document?.documentId || parentID == null || !parentType) {
    return null
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
      <DocumentPreviewDialog
        open={open}
        onClose={() => setOpen(false)}
        parentType={parentType}
        parentID={parentID}
        document={document}
      />
    </>
  )
}

DocumentPreviewButton.propTypes = {
  parentType: PropTypes.string.isRequired,
  parentID: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    .isRequired,
  document: PropTypes.object.isRequired,
  size: PropTypes.oneOf(['small', 'medium', 'large'])
}

export default DocumentPreviewButton
