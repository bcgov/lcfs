import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, Typography, IconButton, Box } from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { styled } from '@mui/system'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCButton from '@/components/BCButton'
import FileUploadIcon from '@mui/icons-material/FileUpload'

const StyledCard = styled(Card)(({ theme, isDragActive }) => ({
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

const UploadCard = () => {
  const { t } = useTranslation(['report'])

  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef(null)

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

  const handleFiles = (files) => {
    // Handle the uploaded files here
    console.log('Uploaded files:', files)
    // You can add your file processing logic here
  }

  const handleCardClick = () => {
    fileInputRef.current.click()
  }

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
    }
  }

  const handleButtonClick = () => {
    console.log('Upload button clicked')
    // Implement your button click logic here
  }

  return (
    <BCWidgetCard
      component="div"
      style={{ height: 'fit-content' }}
      title={t('report:supportingDocs')}
      content={
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <StyledCard
            isDragActive={isDragActive}
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
              <Typography variant="body2" color="textSecondary">
                {t('report:clickDrag')}
              </Typography>
              <Typography
                variant="body2"
                color="textSecondary"
                style={{ marginTop: '10px' }}
              >
                {t('report:acceptedFormats')}
              </Typography>
            </CardContent>
          </StyledCard>
          <Typography
            variant="body2"
            color="textSecondary"
            style={{ marginTop: '10px' }}
          >
            {t('report:uploadLabel')}
          </Typography>
          <BCButton
            data-test="submit-docs"
            size="large"
            variant="contained"
            color="primary"
            onClick={() => {
              console.log('Upload button clicked')
            }}
            startIcon={<FileUploadIcon />}
            sx={{ mt: 2 }}
          >
            {t('report:supportingDocs')}
          </BCButton>
        </Box>
      }
    />
  )
}

export default UploadCard
