import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Icon,
  IconButton,
  Tooltip
} from '@mui/material'
import { CloudUpload, Delete } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { styled } from '@mui/system'
import BCTypography from '@/components/BCTypography'
import BCAlert from '@/components/BCAlert'
import BCModal from '@/components/BCModal'
import prettyBytes from 'pretty-bytes'
import colors from '@/themes/base/colors'
import {
  useDeleteDocument,
  useDocuments,
  useUpdateDocument,
  useUploadDocument,
  useDownloadDocument
} from '@/hooks/useDocuments'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { timezoneFormatter } from '@/utils/formatters'
import {
  MAX_FILE_SIZE_BYTES,
  COMPLIANCE_REPORT_FILE_TYPES,
  isDocumentRenameEnabled
} from '@/constants/common'
import { validateFile } from '@/utils/fileValidation'
import { getDocumentDisplayName } from '@/utils/documents'
import RenameableFileName from '@/components/Documents/RenameableFileName'

const StyledCard = styled(Card)(({ theme, isDragActive = false }) => ({
  width: '100%',
  textAlign: 'center',
  border: '1px dashed #ccc',
  boxShadow: 'none',
  padding: '20px',
  boxSizing: 'border-box',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  backgroundColor: isDragActive ? theme.palette.action.hover : 'transparent',
  '&:hover': {
    backgroundColor: theme.palette.action.hover
  }
}))

const FileTable = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: '100%',
  display: 'grid',
  gridTemplateColumns:
    'minmax(260px, 2fr) 200px minmax(80px, 110px) minmax(90px, 120px) minmax(50px, 70px)',
  gridColumnGap: '8px',
  overflow: 'hidden'
}))

const TableCell = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
  overflow: 'hidden'
})

function DocumentTable({ parentType, parentID }) {
  const { t } = useTranslation(['report', 'common'])
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef(null)
  const [files, setFiles] = useState([])
  const [errorMessage, setErrorMessage] = useState(null)
  const [documentPendingDelete, setDocumentPendingDelete] = useState(null)
  const { data: currentUser, hasRoles } = useCurrentUser()

  const { data: loadedFiles } = useDocuments(parentType, parentID)
  useEffect(() => {
    if (loadedFiles) {
      setFiles(loadedFiles)
    }
  }, [loadedFiles])

  const { mutate: uploadFile } = useUploadDocument(parentType, parentID)
  const { mutate: deleteFile } = useDeleteDocument(parentType, parentID)
  const { mutateAsync: updateDocument } = useUpdateDocument(
    parentType,
    parentID
  )
  const viewDocument = useDownloadDocument(parentType, parentID)
  const renameEnabled = isDocumentRenameEnabled(parentType)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragIn = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragActive(true)
    }
  }

  const handleDragOut = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
      e.dataTransfer.clearData()
    }
  }

  const handleCardClick = () => {
    fileInputRef.current.click()
  }

  const handleFileChange = (e) => {
    handleFiles(e.target.files)
    // Reset the input so selecting the same file(s) again still fires onChange.
    e.target.value = ''
  }

  // Upload every selected/dropped file. Validation and upload progress are
  // applied to each file independently so a range/multi-select uploads them
  // all in a single action (#4739). Single-file selection is the N=1 case.
  const handleFiles = (fileList) => {
    const selected = Array.from(fileList || [])
    if (selected.length === 0) {
      return
    }
    // Clear any existing error message before processing a new batch.
    setErrorMessage(null)
    selected.forEach((file, index) => handleFileUpload(file, index))
  }

  const handleFileUpload = async (file, index = 0) => {
    if (!file) {
      return
    }

    // Unique placeholder id so multiple files selected in the same tick do not
    // collide on their React key or optimistic row.
    const fileId = `${Date.now()}-${index}-${file.name}`

    const baseDocument = {
      documentId: fileId,
      fileName: file.name,
      fileSize: file.size,
      createDate: new Date().toISOString(),
      createUser: currentUser?.keycloakUsername
    }

    // Validate file type and size
    const validation = validateFile(
      file,
      MAX_FILE_SIZE_BYTES,
      COMPLIANCE_REPORT_FILE_TYPES
    )
    if (!validation.isValid) {
      // Show error alert with file name and allowed formats. Functional updates
      // keep every file's row when several are processed in the same batch.
      setErrorMessage(
        `Upload failed for "${file.name}": ${validation.errorMessage}`
      )
      setFiles((prev) => [
        ...prev,
        {
          ...baseDocument,
          error: true,
          errorMessage: validation.errorMessage
        }
      ])
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFiles((prev) => [
        ...prev,
        {
          ...baseDocument,
          oversize: true
        }
      ])
      return
    }

    setFiles((prev) => [
      ...prev,
      {
        ...baseDocument,
        scanning: true
      }
    ])

    uploadFile(file, {
      onError: (error) => {
        if (error.response?.status === 422) {
          // Transition this file's own row from scanning to virus-detected,
          // matched by its placeholder id so sibling uploads are untouched.
          setFiles((prev) =>
            prev.map((f) =>
              f.documentId === fileId
                ? { ...f, scanning: false, virus: true }
                : f
            )
          )
        } else {
          console.error('Error uploading file:', error)
        }
      }
    })
  }

  const handleDeleteFile = async (documentId) => {
    try {
      setFiles(
        files.map((file) => ({
          ...file,
          deleting: file.documentId === documentId
        }))
      )
      await deleteFile(documentId)
    } catch (error) {
      console.error('Error uploading file:', error)
    }
  }

  const handleRenameFile = async (documentId, newDisplayName) => {
    await updateDocument({
      documentID: documentId,
      data: { displayName: newDisplayName }
    })
  }

  const handleDeleteClick = (file) => {
    setDocumentPendingDelete(file)
  }

  const handleCancelDelete = () => {
    setDocumentPendingDelete(null)
  }

  const handleConfirmDelete = async () => {
    if (!documentPendingDelete) return

    await handleDeleteFile(documentPendingDelete.documentId)
    setDocumentPendingDelete(null)
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden'
      }}
    >
      {errorMessage && (
        <BCAlert
          severity="error"
          dismissible={true}
          sx={{ mb: 2, width: '100%' }}
          onClose={() => setErrorMessage(null)}
          data-test="file-upload-error-alert"
        >
          {errorMessage}
        </BCAlert>
      )}
      <input
        id="file"
        type="file"
        multiple
        data-test="file-input"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept={COMPLIANCE_REPORT_FILE_TYPES.ACCEPT_STRING}
        onChange={handleFileChange}
      />
      <StyledCard
        onClick={handleCardClick}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent>
          <IconButton aria-label="upload" size="medium">
            <CloudUpload style={{ fontSize: '40px', color: '#999' }} />
          </IconButton>
          <BCTypography variant="body2">{t('report:clickDrag')}</BCTypography>
        </CardContent>
      </StyledCard>
      <FileTable>
        <TableCell>
          <BCTypography color="primary" variant="subtitle1">
            File Name
          </BCTypography>
        </TableCell>
        <TableCell>
          <BCTypography color="primary" variant="subtitle1">
            Uploaded
          </BCTypography>
        </TableCell>
        <TableCell>
          <BCTypography color="primary" variant="subtitle1">
            Size
          </BCTypography>
        </TableCell>
        <TableCell>
          <BCTypography color="primary" variant="subtitle1">
            Virus Scan
          </BCTypography>
        </TableCell>
        <TableCell></TableCell>

        {files.map((file, i) => {
          const displayName = getDocumentDisplayName(file)
          const canRename =
            renameEnabled &&
            !file.deleting &&
            !file.scanning &&
            !file.virus &&
            !file.oversize &&
            !file.error &&
            file.createUser === currentUser?.keycloakUsername

          return (
            <div style={{ display: 'contents' }} key={file.documentId}>
              <TableCell>
                {!file.oversize && !file.error && (
                  <RenameableFileName
                    displayName={displayName}
                    canRename={canRename}
                    onRename={(newName) =>
                      handleRenameFile(file.documentId, newName)
                    }
                    renderName={(name) => (
                      <BCTypography
                        variant="subtitle2"
                        color="link"
                        onClick={() => {
                          viewDocument(file.documentId, name)
                        }}
                        sx={{
                          '&:hover': { cursor: 'pointer' },
                          textDecoration: 'underline',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%'
                        }}
                        title={name}
                      >
                        {name}
                      </BCTypography>
                    )}
                  />
                )}
                {file.oversize && (
                  <BCTypography
                    variant="subtitle2"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%'
                    }}
                    title={`${file.fileName} (File is over 50MB)`}
                  >
                    {file.fileName} (File is over 50MB)
                  </BCTypography>
                )}
                {file.error && (
                  <BCTypography
                    variant="subtitle2"
                    color="error"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%'
                    }}
                    title={`${file.fileName} (Unsupported file type)`}
                  >
                    {file.fileName} (Unsupported file type)
                  </BCTypography>
                )}
              </TableCell>
              <TableCell>
                <BCTypography
                  variant="body2"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%'
                  }}
                  title={`${timezoneFormatter({ value: file.createDate })}${
                    file.createUser && !hasRoles('Supplier')
                      ? ` - ${file.createUser}`
                      : ''
                  }`}
                >
                  {timezoneFormatter({ value: file.createDate })}
                  {file.createUser && !hasRoles('Supplier')
                    ? ` - ${file.createUser}`
                    : ''}
                </BCTypography>
              </TableCell>
              <TableCell>
                {(file.oversize || file.error) && (
                  <Icon style={{ color: colors.error.main }}>close</Icon>
                )}
                {prettyBytes(file.fileSize)}
              </TableCell>
              <TableCell style={{ justifyContent: 'center' }}>
                {!file.scanning &&
                  !file.virus &&
                  !file.oversize &&
                  !file.error && (
                    <Icon style={{ color: colors.success.main }}>check</Icon>
                  )}
                {file.scanning && <CircularProgress size={22} />}
                {(file.virus || file.error) && (
                  <Icon style={{ color: colors.error.main }}>close</Icon>
                )}
              </TableCell>
              <TableCell>
                <Tooltip title={t('common:deleteBtn')}>
                  <div>
                    {!file.deleting &&
                      !file.virus &&
                      !file.scanning &&
                      !file.oversize &&
                      !file.error &&
                      file.createUser === currentUser?.keycloakUsername && (
                        <IconButton
                          onClick={() => {
                            handleDeleteClick(file)
                          }}
                          aria-label="delete row"
                          data-test="delete-button"
                          color="error"
                        >
                          <Delete style={{ pointerEvents: 'none' }} />
                        </IconButton>
                      )}
                    {file.deleting && <CircularProgress size={22} />}
                  </div>
                </Tooltip>
              </TableCell>
            </div>
          )
        })}
      </FileTable>
      {documentPendingDelete && (
        <BCModal
          open={!!documentPendingDelete}
          onClose={handleCancelDelete}
          data={{
            title: t('report:deleteDocumentConfirmTitle'),
            content: (
              <BCTypography variant="body2">
                {t('report:deleteDocumentConfirmText', {
                  fileName: getDocumentDisplayName(documentPendingDelete)
                })}
              </BCTypography>
            ),
            primaryButtonText: t('common:deleteBtn'),
            primaryButtonAction: handleConfirmDelete,
            primaryButtonColor: 'error',
            secondaryButtonText: t('common:cancelBtn'),
            secondaryButtonAction: handleCancelDelete
          }}
        />
      )}
    </Box>
  )
}

export default DocumentTable
