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
import prettyBytes from 'pretty-bytes'
import colors from '@/themes/base/colors'
import {
  useDeleteDocument,
  useDocuments,
  useUploadDocument,
  useDownloadDocument
} from '@/hooks/useDocuments'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { timezoneFormatter } from '@/utils/formatters'
import {
  MAX_FILE_SIZE_BYTES,
  COMPLIANCE_REPORT_FILE_TYPES
} from '@/constants/common'
import { validateFile } from '@/utils/fileValidation'

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
    'minmax(150px, 1fr) 220px minmax(80px, 120px) minmax(100px, 140px) minmax(50px, 80px)',
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
  const { data: currentUser, hasRoles } = useCurrentUser()

  const { data: loadedFiles } = useDocuments(parentType, parentID)
  useEffect(() => {
    if (loadedFiles) {
      setFiles(loadedFiles)
    }
  }, [loadedFiles])

  const { mutate: uploadFile } = useUploadDocument(parentType, parentID)
  const { mutate: deleteFile } = useDeleteDocument(parentType, parentID)
  const viewDocument = useDownloadDocument(parentType, parentID)

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
      handleFileUpload(e.dataTransfer.files[0])
      e.dataTransfer.clearData()
    }
  }

  const handleCardClick = () => {
    fileInputRef.current.click()
  }

  const handleFileChange = (e) => {
    const files = e.target.files
    if (!files || files.length === 0) {
      return
    }
    handleFileUpload(files[0])
  }

  const handleFileUpload = async (file) => {
    if (!file) {
      return
    }

    // Clear any existing error message
    setErrorMessage(null)

    const fileId = Date.now()

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
      // Show error alert with file name and allowed formats
      setErrorMessage(
        `Upload failed for "${file.name}": ${validation.errorMessage}`
      )
      setFiles([
        ...files,
        {
          ...baseDocument,
          error: true,
          errorMessage: validation.errorMessage
        }
      ])
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFiles([
        ...files,
        {
          ...baseDocument,
          oversize: true
        }
      ])
      return
    }

    setFiles([
      ...files,
      {
        ...baseDocument,
        scanning: true
      }
    ])

    uploadFile(file, {
      onError: (error) => {
        if (error.response?.status === 422) {
          setFiles([
            ...files,
            {
              ...baseDocument,
              virus: true
            }
          ])
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

        {files.map((file, i) => (
          <div style={{ display: 'contents' }} key={file.documentId}>
            <TableCell>
              {!file.oversize && !file.error && (
                <BCTypography
                  variant="subtitle2"
                  color="link"
                  onClick={() => {
                    viewDocument(file.documentId)
                  }}
                  sx={{
                    '&:hover': { cursor: 'pointer' },
                    textDecoration: 'underline',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%'
                  }}
                  title={file.fileName}
                >
                  {file.fileName}
                </BCTypography>
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
                          handleDeleteFile(file.documentId)
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
        ))}
      </FileTable>
    </Box>
  )
}

export default DocumentTable
