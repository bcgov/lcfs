import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Stack,
  TextField,
  Tooltip
} from '@mui/material'
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  FileDownload as FileDownloadIcon
} from '@mui/icons-material'

import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import {
  COMPLIANCE_REPORT_FILE_TYPES,
  MAX_FILE_SIZE_BYTES
} from '@/constants/common'
import {
  useDeleteDocument,
  useDocuments,
  useUploadDocument
} from '@/hooks/useDocuments'
import colors from '@/themes/base/colors'
import { validateFile } from '@/utils/fileValidation'

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
  readOnly = false
}) => {
  const { t } = useTranslation(['common', 'carbonIntensity'])
  const ciApplicationId = ciApplication?.ciApplicationId

  const supportingFileRef = useRef(null)
  const ghgeniusFileRef = useRef(null)

  const [supportingCategory, setSupportingCategory] = useState(
    DOC_CATEGORY_TECHNICAL_REPORT
  )
  const [otherDescription, setOtherDescription] = useState(
    ciApplication?.supportingDocumentOther || ''
  )
  const [uploadError, setUploadError] = useState(null)

  const { data: documents = [], isLoading: isLoadingDocs } = useDocuments(
    PARENT_TYPE,
    ciApplicationId
  )
  const { mutateAsync: uploadDoc, isPending: isUploading } = useUploadDocument(
    PARENT_TYPE,
    ciApplicationId
  )
  const { mutateAsync: deleteDoc, isPending: isDeletingDoc } = useDeleteDocument(
    PARENT_TYPE,
    ciApplicationId
  )

  const hasTechnicalReport = documents.some(
    (d) => d.documentCategory === DOC_CATEGORY_TECHNICAL_REPORT
  )
  const hasGHGeniusModel = documents.some(
    (d) => d.documentCategory === DOC_CATEGORY_GHGENIUS_MODEL
  )

  const handleFileChosen = async (event, category) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const result = validateFile(
      file,
      MAX_FILE_SIZE_BYTES,
      COMPLIANCE_REPORT_FILE_TYPES
    )
    if (!result.isValid) {
      setUploadError(result.errorMessage)
      return
    }
    setUploadError(null)
    try {
      await uploadDoc({ file, documentCategory: category })
    } catch (err) {
      setUploadError(
        err?.response?.data?.detail ||
          err?.message ||
          t('carbonIntensity:step3.errors.uploadFailed')
      )
    }
  }

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

  const canProceed = hasTechnicalReport && hasGHGeniusModel && !readOnly

  const handleSaveAndProceed = async () => {
    setUploadError(null)
    if (!hasTechnicalReport || !hasGHGeniusModel) {
      setUploadError(t('carbonIntensity:step3.errors.missingRequired'))
      return
    }
    await onSave?.({ supportingDocumentOther: otherDescription || null })
  }

  return (
    <Box>
      <BCTypography variant="h6" sx={{ pb: 2, color: colors.primary.main }}>
        {t('carbonIntensity:step3.title')}
      </BCTypography>

      {/* Uploaded documents list */}
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
        ) : documents.length === 0 ? (
          <BCTypography variant="body2" color="text.secondary">
            {t('carbonIntensity:step3.noDocuments')}
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
              <Link href="#" underline="hover" sx={{ minWidth: 0 }} noWrap>
                {doc.fileName}
              </Link>
              <BCTypography variant="body2">
                {formatBytes(doc.fileSize)}
              </BCTypography>
              <BCTypography variant="body2">{doc.createUser || ''}</BCTypography>
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

      {uploadError && (
        <Box mb={2}>
          <BCAlert severity="error" onClose={() => setUploadError(null)}>
            {uploadError}
          </BCAlert>
        </Box>
      )}

      {/* Supporting documentation */}
      <BCTypography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        {t('carbonIntensity:step3.supportingHeader')}
      </BCTypography>

      <Stack direction="row" spacing={2} alignItems="flex-end" sx={{ mb: 1 }}>
        <Box sx={{ minWidth: 340 }}>
          <InputLabel htmlFor="ci-step3-supporting-category" sx={{ pb: 1 }}>
            {t('carbonIntensity:step3.documentCategoryLabel')}
          </InputLabel>
          <TextField
            select
            id="ci-step3-supporting-category"
            value={supportingCategory}
            onChange={(e) => setSupportingCategory(e.target.value)}
            disabled={readOnly}
            fullWidth
            variant="outlined"
            inputProps={{ 'data-test': 'ci-step3-supporting-category' }}
          >
            <MenuItem value={DOC_CATEGORY_TECHNICAL_REPORT}>
              {t('carbonIntensity:step3.categoryTechnicalReport')}
            </MenuItem>
            <MenuItem value={DOC_CATEGORY_SUPPORTING}>
              {t('carbonIntensity:step3.categorySupporting')}
            </MenuItem>
          </TextField>
        </Box>
        <BCButton
          type="button"
          variant="outlined"
          color="primary"
          startIcon={<CloudUploadIcon />}
          onClick={() => supportingFileRef.current?.click()}
          disabled={readOnly || isUploading}
          data-test="ci-step3-upload-supporting"
          sx={{ height: 56 }}
        >
          {t('carbonIntensity:step3.uploadSupporting')}
        </BCButton>
        <input
          ref={supportingFileRef}
          type="file"
          accept={COMPLIANCE_REPORT_FILE_TYPES.ACCEPT_STRING}
          hidden
          onChange={(e) => handleFileChosen(e, supportingCategory)}
          data-test="ci-step3-supporting-input"
        />
      </Stack>

      <Box component="ul" sx={{ pl: 3, mb: 2 }}>
        <li>
          <BCTypography variant="body2">
            {t('carbonIntensity:step3.bullets.technicalReport')}
            {!hasTechnicalReport && (
              <BCTypography
                component="span"
                variant="body2"
                color="error"
                sx={{ ml: 1 }}
              >
                {t('carbonIntensity:step3.notUploaded')}
              </BCTypography>
            )}
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

      {/* GHGenius modelling */}
      <BCTypography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        {t('carbonIntensity:step3.ghgeniusHeader')}
      </BCTypography>
      <BCTypography variant="body2" sx={{ mb: 2 }}>
        {t('carbonIntensity:step3.ghgeniusIntro')}
      </BCTypography>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <BCButton
          type="button"
          variant="outlined"
          color="primary"
          startIcon={<CloudUploadIcon />}
          onClick={() => ghgeniusFileRef.current?.click()}
          disabled={readOnly || isUploading}
          data-test="ci-step3-upload-ghgenius"
        >
          {t('carbonIntensity:step3.uploadGHGenius')}
        </BCButton>
        <BCButton
          type="button"
          variant="outlined"
          color="primary"
          startIcon={<FileDownloadIcon />}
          href="/templates/ghgenius-input-output.xlsx"
          download
          data-test="ci-step3-download-template"
        >
          {t('carbonIntensity:step3.downloadTemplate')}
        </BCButton>
        <input
          ref={ghgeniusFileRef}
          type="file"
          accept={COMPLIANCE_REPORT_FILE_TYPES.ACCEPT_STRING}
          hidden
          onChange={(e) => handleFileChosen(e, DOC_CATEGORY_GHGENIUS_MODEL)}
          data-test="ci-step3-ghgenius-input"
        />
      </Stack>

      {!hasGHGeniusModel && (
        <BCTypography variant="body2" color="error" sx={{ mb: 2 }}>
          {t('carbonIntensity:step3.ghgeniusRequired')}
        </BCTypography>
      )}

      <Stack direction="row" spacing={2} sx={{ mt: 2 }} alignItems="center">
        <BCButton
          type="button"
          variant="contained"
          color="primary"
          onClick={handleSaveAndProceed}
          disabled={!canProceed || isSaving || isUploading}
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
    </Box>
  )
}

DocumentsModellingStep.displayName = 'DocumentsModellingStep'
