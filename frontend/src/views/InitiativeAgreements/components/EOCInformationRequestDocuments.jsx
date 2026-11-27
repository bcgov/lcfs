import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Link from '@mui/material/Link'
import TextField from '@mui/material/TextField'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { DOCUMENT_FILE_TYPES, MAX_FILE_SIZE_BYTES } from '@/constants/common'
import { useDownloadDocument } from '@/hooks/useDocuments'
import {
  useDeleteEocInformationDocument,
  useRenameEocInformationDocument,
  useUploadEocInformationDocument
} from '@/hooks/useInitiativeAgreements'
import { validateFile } from '@/utils/fileValidation'

const fileLabel = (document) => document.displayName || document.fileName

const errorDetail = (err) => err?.response?.data?.detail || err?.message || ''

/**
 * The files a proponent adds while answering one request for additional
 * information (#5545). Editable while the request is open: add, rename and
 * remove the files you added. Read-only, it lists what was submitted.
 */
export const EOCInformationRequestDocuments = ({
  designatedActionId,
  request,
  requirementNumber,
  editable = false,
  onAnnounce = () => {}
}) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const headingId = useId()
  const inputRef = useRef(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [renaming, setRenaming] = useState(null)
  const [newName, setNewName] = useState('')
  const [renameError, setRenameError] = useState('')
  const [removing, setRemoving] = useState(null)
  const download = useDownloadDocument('designatedAction', designatedActionId)
  const { mutateAsync: upload } =
    useUploadEocInformationDocument(designatedActionId)
  const { mutateAsync: rename, isPending: renamePending } =
    useRenameEocInformationDocument(designatedActionId)
  const { mutateAsync: remove, isPending: removePending } =
    useDeleteEocInformationDocument(designatedActionId)
  const documents = request.documents || []

  const addFiles = async (event) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    setError('')
    setUploading(true)
    const failures = []
    for (const file of files) {
      const check = validateFile(file, MAX_FILE_SIZE_BYTES, DOCUMENT_FILE_TYPES)
      if (!check.isValid) {
        failures.push(
          t('initiativeAgreement:informationRequest.uploadFailed', {
            name: file.name,
            reason: check.errorMessage
          })
        )
        continue
      }
      onAnnounce(
        t('initiativeAgreement:informationRequest.uploading', {
          name: file.name
        })
      )
      try {
        await upload({ requestId: request.id, file })
        onAnnounce(
          t('initiativeAgreement:informationRequest.uploaded', {
            name: file.name
          })
        )
      } catch (err) {
        failures.push(
          t('initiativeAgreement:informationRequest.uploadFailed', {
            name: file.name,
            reason: errorDetail(err)
          })
        )
      }
    }
    setUploading(false)
    if (failures.length) setError(failures.join('\n'))
  }

  const submitRename = async (event) => {
    event.preventDefault()
    if (!newName.trim()) {
      setRenameError(t('initiativeAgreement:informationRequest.renameFailed'))
      return
    }
    try {
      await rename({
        requestId: request.id,
        documentId: renaming.documentId,
        displayName: newName.trim()
      })
      setRenaming(null)
      onAnnounce(t('initiativeAgreement:informationRequest.renamed'))
    } catch (err) {
      setRenameError(
        errorDetail(err) ||
          t('initiativeAgreement:informationRequest.renameFailed')
      )
    }
  }

  const confirmRemove = async () => {
    const target = removing
    try {
      await remove({ requestId: request.id, documentId: target.documentId })
      setRemoving(null)
      onAnnounce(
        t('initiativeAgreement:informationRequest.removed', {
          name: fileLabel(target)
        })
      )
    } catch (err) {
      setRemoving(null)
      setError(
        errorDetail(err) ||
          t('initiativeAgreement:informationRequest.removeFailed')
      )
    }
  }

  return (
    <Box
      component="section"
      aria-labelledby={headingId}
      data-test={`eoc-information-documents-${request.id}`}
    >
      <BCTypography
        id={headingId}
        variant="body4"
        component="h4"
        sx={{ fontWeight: 700, color: 'primary.main', mb: 0.75 }}
      >
        {editable
          ? t('initiativeAgreement:informationRequest.attachments')
          : t('initiativeAgreement:informationRequest.filesHeading')}
      </BCTypography>
      {error && (
        <Alert severity="error" role="alert" sx={{ mb: 1 }}>
          <span style={{ whiteSpace: 'pre-line' }}>{error}</span>
        </Alert>
      )}
      {documents.length ? (
        <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {documents.map((document) => (
            <Box
              component="li"
              key={document.documentId}
              sx={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
                py: 0.5
              }}
            >
              <Link
                component="button"
                type="button"
                variant="body2"
                onClick={() =>
                  download(document.documentId, fileLabel(document))
                }
                aria-label={t(
                  'initiativeAgreement:informationRequest.download',
                  {
                    name: fileLabel(document)
                  }
                )}
                sx={{ textDecoration: 'underline' }}
              >
                {fileLabel(document)}
              </Link>
              {editable && document.canChange && (
                <>
                  <Button
                    size="small"
                    onClick={() => {
                      setRenaming(document)
                      setNewName(fileLabel(document))
                      setRenameError('')
                    }}
                    aria-label={t(
                      'initiativeAgreement:informationRequest.renameFile',
                      { name: fileLabel(document) }
                    )}
                    data-test={`eoc-information-rename-${document.documentId}`}
                  >
                    {t('initiativeAgreement:informationRequest.rename')}
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => setRemoving(document)}
                    aria-label={t(
                      'initiativeAgreement:informationRequest.removeFile',
                      { name: fileLabel(document) }
                    )}
                    data-test={`eoc-information-remove-${document.documentId}`}
                  >
                    {t('initiativeAgreement:informationRequest.remove')}
                  </Button>
                </>
              )}
            </Box>
          ))}
        </Box>
      ) : (
        <BCTypography variant="body4" component="p" color="text.secondary">
          {t('initiativeAgreement:informationRequest.noAttachments')}
        </BCTypography>
      )}
      {editable && (
        <Box mt={1}>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={addFiles}
            data-test={`eoc-information-file-input-${request.id}`}
          />
          <BCButton
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<AttachFileIcon aria-hidden="true" />}
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            aria-label={t(
              'initiativeAgreement:informationRequest.addFilesFor',
              {
                number: requirementNumber
              }
            )}
            data-test={`eoc-information-add-files-${request.id}`}
          >
            {t('initiativeAgreement:informationRequest.addFiles')}
          </BCButton>
        </Box>
      )}

      <Dialog
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        aria-labelledby={`${headingId}-rename-title`}
      >
        <form onSubmit={submitRename} noValidate>
          <DialogTitle id={`${headingId}-rename-title`}>
            {renaming &&
              t('initiativeAgreement:informationRequest.renameFile', {
                name: fileLabel(renaming)
              })}
          </DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              margin="dense"
              label={t('initiativeAgreement:informationRequest.renameLabel')}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              error={Boolean(renameError)}
              helperText={renameError || ' '}
              inputProps={{
                'aria-invalid': Boolean(renameError),
                'data-test': 'eoc-information-rename-input'
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRenaming(null)}>
              {t('initiativeAgreement:informationRequest.cancel')}
            </Button>
            <Button type="submit" variant="contained" disabled={renamePending}>
              {t('initiativeAgreement:informationRequest.rename')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        aria-labelledby={`${headingId}-remove-title`}
        aria-describedby={`${headingId}-remove-body`}
      >
        <DialogTitle id={`${headingId}-remove-title`}>
          {t('initiativeAgreement:informationRequest.removeConfirmTitle')}
        </DialogTitle>
        <DialogContent>
          <BCTypography id={`${headingId}-remove-body`} component="p">
            {removing &&
              t('initiativeAgreement:informationRequest.removeConfirmBody', {
                name: fileLabel(removing)
              })}
          </BCTypography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoving(null)}>
            {t('initiativeAgreement:informationRequest.cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={removePending}
            onClick={confirmRemove}
            data-test="eoc-information-remove-confirm"
          >
            {t('initiativeAgreement:informationRequest.remove')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default EOCInformationRequestDocuments
