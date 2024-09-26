import BCModal from '@/components/BCModal'
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
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { useTranslation } from 'react-i18next'
import { styled } from '@mui/system'
import BCTypography from '@/components/BCTypography'
import { Delete } from '@mui/icons-material'
import {
  useComplianceReportDocuments,
  useDeleteComplianceReportDocument,
  useUploadComplianceReportDocument
} from '@/hooks/useComplianceReports'
import prettyBytes from 'pretty-bytes'
import colors from '@/themes/base/colors'
import axios from 'axios'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes'

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
  display: 'grid',
  gridTemplateColumns: '1fr max-content max-content max-content',
  gridColumnGap: '8px'
}))

const TableCell = styled(Box)({
  display: 'flex',
  alignItems: 'center'
})

function DocumentUploadDialog({ open, close, reportID }) {
  const { t } = useTranslation(['report'])
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [files, setFiles] = useState([])
  const apiService = useApiService()

  const { data: loadedFiles, isLoading } =
    useComplianceReportDocuments(reportID)
  useEffect(() => {
    if (loadedFiles) {
      setFiles(loadedFiles)
    }
  }, [loadedFiles])

  const { mutate: uploadFile } = useUploadComplianceReportDocument(reportID)
  const { mutate: deleteFile } = useDeleteComplianceReportDocument(reportID)

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

  const viewDocument = async (documentID) => {
    if (!documentID) return
    const res = await apiService.get(
      apiRoutes.getComplianceReportDocumentUrl
        .replace(':reportID', reportID)
        .replace(':documentID', documentID),
      {
        responseType: 'blob'
      }
    )
    const fileURL = URL.createObjectURL(res.data)
    window.open(fileURL, '_blank')
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
    handleFileUpload(files[0])
  }

  const handleFileUpload = async (file) => {
    if (!file) {
      return
    }

    try {
      uploadFile(file)
      setFiles([
        ...files,
        {
          documentId: 'new',
          fileName: file.name,
          fileSize: file.size,
          scanning: true
        }
      ])
    } catch (error) {
      console.error('Error uploading file:', error)
    } finally {
      setFile(null)
    }
  }

  const handleDeleteFile = async (documentId) => {
    try {
      deleteFile(documentId)
      setFiles(
        files.map((file) => ({
          ...file,
          deleting: file.documentId === documentId
        }))
      )
    } catch (error) {
      console.error('Error uploading file:', error)
    } finally {
      setFile(null)
    }
  }

  const onClose = () => {
    close()
  }

  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      <BCTypography variant="body2" style={{ marginTop: '10px' }}>
        Add file attachments (maximum file size: 50 MB):
      </BCTypography>
      <input
        id="file"
        type="file"
        data-test="file-input"
        ref={fileInputRef}
        style={{ display: 'none' }}
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
            <CloudUploadIcon style={{ fontSize: '40px', color: '#999' }} />
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
            <TableCell
              onClick={() => {
                viewDocument(file.documentId)
              }}
            >
              <BCTypography
                variant="subtitle2"
                color="link"
                sx={{
                  textDecoration: 'underline',
                  '&:hover': { color: 'info.main' }
                }}
              >
                {file.fileName}
              </BCTypography>
            </TableCell>
            <TableCell>{prettyBytes(file.fileSize)}</TableCell>
            <TableCell style={{ justifyContent: 'center' }}>
              {!file.scanning && (
                <Icon style={{ color: colors.success.main }}>check</Icon>
              )}
              {file.scanning && <CircularProgress size={22} />}
            </TableCell>
            <TableCell>
              <Tooltip title="Delete">
                {!file.deleting && (
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
              </Tooltip>
            </TableCell>
          </div>
        ))}
      </FileTable>
    </Box>
  )

  return (
    <BCModal
      onClose={onClose}
      open={open}
      data={{
        title: 'Upload supporting documents for your compliance report',
        primaryButtonAction: onClose,
        primaryButtonText: 'Return to compliance report',
        content
      }}
    ></BCModal>
  )
}

export default DocumentUploadDialog
