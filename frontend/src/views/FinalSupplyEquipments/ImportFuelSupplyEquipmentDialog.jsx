import BCModal from '@/components/BCModal'
import { Box, Card, CardContent, IconButton } from '@mui/material'
import LinearProgress from '@mui/material/LinearProgress'
import { useTranslation } from 'react-i18next'
import BCTypography from '@/components/BCTypography'
import {
  useGetFinalSupplyEquipmentImportJobStatus,
  useImportFinalSupplyEquipment
} from '@/hooks/useFinalSupplyEquipment.js'
import { styled } from '@mui/system'
import { CloudUpload } from '@mui/icons-material'
import { useEffect, useRef, useState } from 'react'
import { MAX_FILE_SIZE_BYTES } from '@/constants/common.js'
import BCAlert from '@/components/BCAlert/index.jsx'
import BCBox from '@/components/BCBox/index.jsx'

function LinearProgressWithLabel(props) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Box sx={{ width: '100%', mr: 1 }}>
        <LinearProgress variant="determinate" {...props} />
      </Box>
      <Box sx={{ minWidth: 35 }}>
        <BCTypography variant="body2">{`${Math.round(
          props.value
        )}%`}</BCTypography>
      </Box>
    </Box>
  )
}

const StyledCard = styled(Card)(({ theme }) => ({
  width: '100%',
  textAlign: 'center',
  border: '1px solid #ccc',
  boxShadow: 'none',
  padding: '20px',
  boxSizing: 'border-box',
  transition: 'all 0.3s ease'
}))

const DragDropCard = styled(StyledCard)(({ theme }) => ({
  border: '1px dashed #ccc',
  cursor: 'pointer',
  backgroundColor: 'transparent',
  '&:hover': {
    backgroundColor: theme.palette.action.hover
  }
}))

const DIALOG_STATES = {
  SELECT_FILE: 'SELECT_FILE',
  UPLOADING: 'UPLOADING',
  COMPLETED: 'COMPLETED'
}

function ImportFuelSupplyEquipmentDialog({
  open,
  close,
  complianceReportId,
  isOverwrite
}) {
  const { t } = useTranslation(['report', 'finalSupplyEquipment'])
  const fileInputRef = useRef(null)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [dialogState, setDialogState] = useState(DIALOG_STATES.SELECT_FILE)

  // Upload progress and status
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('Starting Import...')
  const [errorMsg, setErrorMsg] = useState(null)
  const [errorMsgs, setErrorMsgs] = useState([])

  // Job tracking
  const [jobID, setJobID] = useState(null)
  const [intervalID, setIntervalID] = useState(null)

  // Imported/Rejected counts
  const [createdCount, setCreatedCount] = useState(0)
  const [rejectedCount, setRejectedCount] = useState(0)

  const { mutate: importFile } = useImportFinalSupplyEquipment(
    complianceReportId,
    {
      onSuccess: (data) => {
        setJobID(data.data.jobId)
      },
      onError: (error) => {
        setDialogState(DIALOG_STATES.COMPLETED)
        if (error.response?.status === 422) {
          setUploadedFile(null)
          setErrorMsg('Virus detected, please choose another file')
        } else {
          setErrorMsg('Failed to upload file.')
        }
      }
    }
  )

  const { data, refetch } = useGetFinalSupplyEquipmentImportJobStatus(jobID)

  useEffect(() => {
    let intervalId

    if (jobID && open) {
      intervalId = setInterval(async () => {
        try {
          await refetch()
          if (data) {
            setUploadProgress(data.progress)
            setUploadStatus(data.status)
            setCreatedCount(data.created)
            setRejectedCount(data.rejected)

            if (data.progress >= 100) {
              setDialogState(DIALOG_STATES.COMPLETED)
              setErrorMsgs(data.errors)
              clearInterval(intervalId)
              setIntervalID(null)
              setJobID(null)
            }
          }
        } catch (error) {
          clearInterval(intervalId)
          setIntervalID(null)
        }
      }, 300)
      setIntervalID(intervalId)
    }

    // Clean up the interval on unmount or if jobID/open changes
    return () => {
      if (intervalId) {
        clearInterval(intervalId)
        setIntervalID(null)
      }
    }
  }, [jobID, data, refetch, open])

  const preventBrowserDefaults = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleClose = () => {
    setErrorMsg(null)
    setUploadedFile(null)
    setDialogState(DIALOG_STATES.SELECT_FILE)
    setUploadProgress(0)
    setJobID(null)
    setCreatedCount(0)
    setRejectedCount(0)
    setErrorMsgs([])
    setUploadStatus('Starting Import...')

    if (intervalID) {
      clearInterval(intervalID)
      setIntervalID(null)
    }

    close()
  }

  const handleDrop = (e) => {
    preventBrowserDefaults(e)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0])
      e.dataTransfer.clearData()
    }
  }

  const handleCardClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = (e) => {
    const fileList = e.target.files
    if (fileList && fileList.length > 0) {
      handleFileUpload(fileList[0])
    }
  }

  const startImport = (file) => {
    setDialogState(DIALOG_STATES.UPLOADING)
    setUploadProgress(0)
    importFile({ file, isOverwrite })
  }

  const handleFileUpload = (file) => {
    setErrorMsg(null)
    if (!file) return

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadedFile(null)
      setErrorMsg('File larger than 50MB')
      return
    }

    setUploadedFile({
      documentId: Date.now(),
      fileName: file.name,
      fileSize: file.size
    })
    startImport(file)
  }

  const renderUploadStatus = () => {
    switch (dialogState) {
      case DIALOG_STATES.SELECT_FILE:
        return (
          <DragDropCard
            onClick={handleCardClick}
            onDragEnter={preventBrowserDefaults}
            onDragLeave={preventBrowserDefaults}
            onDragOver={preventBrowserDefaults}
            onDrop={handleDrop}
          >
            <CardContent>
              <IconButton aria-label="upload" size="medium">
                <CloudUpload style={{ fontSize: '40px', color: '#999' }} />
              </IconButton>
              <BCTypography variant="body2">
                {t('finalSupplyEquipment:importSelectorText')}
              </BCTypography>
            </CardContent>
          </DragDropCard>
        )

      case DIALOG_STATES.UPLOADING:
        return (
          <StyledCard>
            <CardContent>
              <BCTypography variant="body2">{uploadStatus}</BCTypography>
              <LinearProgressWithLabel value={uploadProgress} />
              <Box>
                <BCTypography variant="body2">
                  Imported:{' '}
                  <BCTypography color="success" component="span">
                    {createdCount}
                  </BCTypography>
                </BCTypography>
                <BCTypography variant="body2">
                  Rejected:{' '}
                  <BCTypography color="error" component="span">
                    {rejectedCount}
                  </BCTypography>
                </BCTypography>
              </Box>
            </CardContent>
          </StyledCard>
        )

      case DIALOG_STATES.COMPLETED:
      default:
        return (
          <StyledCard>
            <CardContent>
              {uploadedFile ? (
                <>
                  <BCTypography variant="body">
                    Completed Importing {uploadedFile.fileName}
                  </BCTypography>
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Box sx={{ display: 'flex' }}>
                      <BCTypography variant="body2">
                        Imported:&nbsp;
                      </BCTypography>
                      <BCTypography variant="body2" color="success">
                        {createdCount}
                      </BCTypography>
                    </Box>
                    <Box sx={{ display: 'flex', ml: 2 }}>
                      <BCTypography variant="body2">
                        Rejected:&nbsp;
                      </BCTypography>
                      <BCTypography variant="body2" color="error">
                        {rejectedCount}
                      </BCTypography>
                    </Box>
                  </Box>
                </>
              ) : (
                <BCTypography color="error" variant="h4">
                  Failed to import
                </BCTypography>
              )}
            </CardContent>
          </StyledCard>
        )
    }
  }

  return (
    <BCModal
      onClose={handleClose}
      open={open}
      data={{
        title: `Upload Excel File - ${isOverwrite ? 'Overwrite' : 'Append'}`,
        secondaryButtonAction: handleClose,
        secondaryButtonText:
          dialogState === DIALOG_STATES.COMPLETED ? 'Close' : 'Cancel',
        content: (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <BCTypography variant="body2" sx={{ mt: 1 }}>
              {t('finalSupplyEquipment:importDialogHeader')}
            </BCTypography>

            {/* Hidden file input for manual file selection */}
            <input
              id="file"
              type="file"
              data-test="file-input"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {/* Render UI based on current dialog state */}
            {renderUploadStatus()}

            {/* Errors from the job (e.g. row-level rejects) */}
            {!!errorMsgs.length && (
              <BCBox sx={{ width: '100%', ml: 2 }}>
                <BCTypography color="error" variant="body">
                  Rejected
                </BCTypography>
                {errorMsgs.map((msg, idx) => (
                  <BCTypography key={idx} variant="body2">
                    {msg}
                  </BCTypography>
                ))}
              </BCBox>
            )}

            {!!errorMsg && (
              <BCAlert style={{ marginTop: '12px' }} severity="error">
                {errorMsg}
              </BCAlert>
            )}
          </Box>
        )
      }}
    />
  )
}

export default ImportFuelSupplyEquipmentDialog
