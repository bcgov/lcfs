import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, IconButton, Link, Stack, TextField, Tooltip } from '@mui/material'
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon
} from '@mui/icons-material'

import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'
import {
  useDeleteDocument,
  useDocuments,
  useDownloadDocument
} from '@/hooks/useDocuments'
import colors from '@/themes/base/colors'

// CI document-category constants. Uploading no longer tags a category (Step 3
// now uses the shared upload modal — #4740), but these remain the canonical
// category values consumed by the resume-step logic (ciResumeStep) and the
// legacy categorized layout (DocumentsModellingStep.legacy.jsx — see #4669).
export const DOC_CATEGORY_TECHNICAL_REPORT = 'technical_report'
export const DOC_CATEGORY_GHGENIUS_MODEL = 'ghgenius_model'
export const DOC_CATEGORY_SUPPORTING = 'supporting'

const PARENT_TYPE = 'ci_application'

const formatBytes = (bytes) => {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const formatDate = (iso) => (iso ? String(iso).slice(0, 10) : '')

export const DocumentsModellingStep = ({
  ciApplication,
  onSave,
  onDelete,
  isSaving = false,
  readOnly = false,
  showTitle = true,
  showSaveControls = true
}) => {
  const { t } = useTranslation(['common', 'carbonIntensity'])
  const ciApplicationId = ciApplication?.ciApplicationId

  const [otherDescription, setOtherDescription] = useState(
    ciApplication?.supportingDocumentOther || ''
  )
  const [uploadError, setUploadError] = useState(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)

  const { data: documents = [], isLoading: isLoadingDocs } = useDocuments(
    PARENT_TYPE,
    ciApplicationId
  )
  const { mutateAsync: deleteDoc, isPending: isDeletingDoc } =
    useDeleteDocument(PARENT_TYPE, ciApplicationId)
  const downloadDocument = useDownloadDocument(PARENT_TYPE, ciApplicationId)

  const hasDocuments = documents.length > 0

  const handleDelete = async (documentId) => {
    try {
      await deleteDoc(documentId)
    } catch (err) {
      setUploadError(
        err?.response?.data?.detail ||
          err?.message ||
          t('carbonIntensity:step3.errors.deleteFailed')
      )
    }
  }

  // Required-upload validation is intentionally disabled for the simplified
  // flow (#4669). The previous mandatory Technical report / GHGenius checks are
  // retained in DocumentsModellingStep.legacy.jsx (frontend) and behind the
  // backend CI_STEP3_REQUIRE_DOCUMENTS flag. Proceeding is always allowed here.
  const canProceed = !readOnly

  const handleSaveAndProceed = async () => {
    setUploadError(null)
    await onSave?.({ supportingDocumentOther: otherDescription || null })
  }

  return (
    <Box>
      {showTitle && (
        <BCTypography variant="h6" sx={{ pb: 2, color: colors.primary.main }}>
          {t('carbonIntensity:step3.title')}
        </BCTypography>
      )}

      {/* Uploaded documents — hidden until at least one document exists (#4669) */}
      {hasDocuments && (
        <BCBox
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
            mb: 3,
            maxHeight: 240,
            overflowY: 'auto'
          }}
          data-test="ci-step3-uploaded-list"
        >
          <BCTypography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            {t('carbonIntensity:step3.uploadedHeader')}
          </BCTypography>
          {isLoadingDocs ? (
            <BCTypography variant="body2" color="text.secondary">
              {t('common:loading')}
            </BCTypography>
          ) : (
            documents.map((doc) => (
              <Box
                key={doc.documentId}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                  alignItems: 'center',
                  py: 0.5,
                  gap: 2
                }}
                data-test="ci-step3-uploaded-row"
              >
                <Link
                  component="button"
                  type="button"
                  underline="hover"
                  onClick={() => downloadDocument(doc.documentId, doc.fileName)}
                  sx={{
                    minWidth: 0,
                    textAlign: 'left',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={doc.fileName}
                  data-test="ci-step3-download-doc"
                >
                  {doc.fileName}
                </Link>
                <BCTypography variant="body2">
                  {formatBytes(doc.fileSize)}
                </BCTypography>
                <BCTypography variant="body2">
                  {doc.createUser || ''}
                </BCTypography>
                <BCTypography variant="body2">
                  {formatDate(doc.createDate)}
                </BCTypography>
                {!readOnly && (
                  <Tooltip title={t('common:deleteBtn')}>
                    <span>
                      <IconButton
                        aria-label="delete document"
                        size="small"
                        onClick={() => handleDelete(doc.documentId)}
                        disabled={isDeletingDoc}
                        data-test="ci-step3-delete-doc"
                      >
                        <DeleteIcon fontSize="small" color="error" />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </Box>
            ))
          )}
        </BCBox>
      )}

      {uploadError && (
        <Box mb={2}>
          <BCAlert severity="error" onClose={() => setUploadError(null)}>
            {uploadError}
          </BCAlert>
        </Box>
      )}

      {/* Upload via the shared document upload modal (#4740). Opening the
          modal shows the common drag-and-drop component (with the allowed file
          types and multi-file selection) rather than immediately opening the
          OS file browser. */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <BCButton
          type="button"
          variant="outlined"
          color="primary"
          size="medium"
          startIcon={<CloudUploadIcon sx={{ fontSize: '1.5rem !important' }} />}
          onClick={() => setUploadDialogOpen(true)}
          disabled={readOnly}
          data-test="ci-step3-upload-supporting"
        >
          {t('carbonIntensity:step3.uploadSupporting')}
        </BCButton>
      </Stack>

      {/* Guidance on what to include — informational only, not enforced (#4669) */}
      <Box component="ul" sx={{ pl: 3, mb: 2 }} data-test="ci-step3-guidance">
        <li>
          <BCTypography variant="body2">
            {t('carbonIntensity:step3.bullets.technicalReport')}
          </BCTypography>
        </li>
        <li>
          <BCTypography variant="body2">
            {t('carbonIntensity:step3.bullets.ghgeniusTemplate')}
          </BCTypography>
        </li>
        <li>
          <BCTypography variant="body2">
            {t('carbonIntensity:step3.bullets.notification')}
          </BCTypography>
        </li>
        <li>
          <BCTypography variant="body2">
            {t('carbonIntensity:step3.bullets.other')}
          </BCTypography>
        </li>
      </Box>

      <TextField
        fullWidth
        value={otherDescription}
        onChange={(e) => setOtherDescription(e.target.value)}
        disabled={readOnly}
        placeholder={t('carbonIntensity:step3.otherPlaceholder')}
        inputProps={{
          'data-test': 'ci-step3-other-description',
          maxLength: 1000
        }}
        sx={{ mb: 4 }}
      />

      {showSaveControls && (
        <Stack direction="row" spacing={2} sx={{ mt: 2 }} alignItems="center">
          <BCButton
            type="button"
            variant="contained"
            color="primary"
            onClick={handleSaveAndProceed}
            disabled={!canProceed || isSaving}
            data-test="ci-step3-save-btn"
          >
            {t('carbonIntensity:step3.saveAndProceed')}
          </BCButton>
          {ciApplicationId && onDelete && (
            <BCButton
              type="button"
              variant="outlined"
              color="error"
              onClick={onDelete}
              disabled={readOnly || isSaving}
              data-test="ci-step3-delete-btn"
            >
              {t('carbonIntensity:step1.deleteDraft')}
            </BCButton>
          )}
        </Stack>
      )}

      {ciApplicationId && (
        <DocumentUploadDialog
          open={uploadDialogOpen}
          close={() => setUploadDialogOpen(false)}
          parentType={PARENT_TYPE}
          parentID={ciApplicationId}
        />
      )}
    </Box>
  )
}

DocumentsModellingStep.displayName = 'DocumentsModellingStep'
