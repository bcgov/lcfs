import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Collapse, Paper } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import RestoreIcon from '@mui/icons-material/Restore'
import prettyBytes from 'pretty-bytes'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import {
  useDeletedDocuments,
  useRestoreDocument
} from '@/hooks/useDocumentFolders'
import { timezoneFormatter } from '@/utils/formatters'

// The bin beneath the document tree. Nothing removed from the tree is
// destroyed — it lands here and stays, so the tree can be kept tidy
// without anything being lost.
export const DeletedItems = ({ parentType, parentID }) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [expanded, setExpanded] = useState(false)
  const { data } = useDeletedDocuments(parentType, parentID)
  const { mutate: restore } = useRestoreDocument(parentType, parentID)

  const documents = data?.documents ?? []
  const total = data?.total ?? 0

  return (
    <Paper
      variant="outlined"
      sx={{ mt: 2, p: 1.5 }}
      data-test="deleted-items-section"
    >
      {/* The whole header toggles, not just the chevron — a small target
          in a full-width row is a needless miss. */}
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        data-test="deleted-items-header"
        onClick={() => setExpanded((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setExpanded((open) => !open)
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          cursor: 'pointer',
          borderRadius: 1,
          '&:hover': { bgcolor: 'action.hover' }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteOutlineIcon fontSize="small" color="action" />
          <BCTypography variant="body4" sx={{ fontWeight: 700 }}>
            {t('initiativeAgreement:folders.deletedItems')}
          </BCTypography>
          {/* The count shows while collapsed, so a full bin is visible
              without opening it. */}
          <BCBox
            component="span"
            data-test="deleted-items-count"
            sx={{
              px: 1,
              py: 0.1,
              borderRadius: 4,
              bgcolor: 'action.selected',
              fontSize: '0.8rem'
            }}
          >
            {total}
          </BCBox>
        </Box>
        {/* The row is the control; this is only its affordance. */}
        <Box
          component="span"
          aria-hidden="true"
          sx={{ display: 'inline-flex', color: 'action.active', p: 0.5 }}
        >
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {documents.length === 0 ? (
            <BCTypography variant="body4" color="text.secondary">
              {t('initiativeAgreement:folders.binEmpty')}
            </BCTypography>
          ) : (
            documents.map((document) => (
              <Box
                key={document.documentId}
                data-test={`deleted-item-${document.documentId}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  flexWrap: 'wrap'
                }}
              >
                <BCTypography variant="subtitle2">
                  {document.fileName}
                </BCTypography>
                <BCTypography variant="subtitle2" color="text.secondary">
                  {prettyBytes(document.fileSize ?? 0)}
                  {' · '}
                  {t('initiativeAgreement:folders.deletedBy', {
                    name: document.deletedByName || document.deletedBy || '—'
                  })}
                  {' · '}
                  {timezoneFormatter({ value: document.deletedDate })}
                </BCTypography>
                <BCTypography variant="subtitle2" color="text.secondary">
                  {document.restoreFolderName
                    ? t('initiativeAgreement:folders.restoreTo', {
                        folder: document.restoreFolderName
                      })
                    : t('initiativeAgreement:folders.restoreToRoot')}
                </BCTypography>
                <BCTypography
                  component="button"
                  type="button"
                  variant="subtitle2"
                  color="link"
                  data-test={`restore-${document.documentId}`}
                  onClick={() => restore(document.documentId)}
                  sx={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5
                  }}
                >
                  <RestoreIcon fontSize="inherit" />
                  {t('initiativeAgreement:folders.restore')}
                </BCTypography>
              </Box>
            ))
          )}
          {documents.length === 0 && (
            <BCTypography variant="body4" color="text.secondary" component="p">
              {t('initiativeAgreement:folders.binHelp')}
            </BCTypography>
          )}
        </Box>
      </Collapse>
    </Paper>
  )
}

export default DeletedItems
