import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import DOMPurify from 'dompurify'
import mammoth from 'mammoth/mammoth.browser'
import * as XLSX from 'xlsx'
import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tab,
  Tabs
} from '@mui/material'
import { Close, Download } from '@mui/icons-material'

import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { useDownloadDocument, useFetchDocument } from '@/hooks/useDocuments'
import { getDocumentDisplayName } from '@/utils/documents'

const OFFICE_MIME_TYPES = {
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
}

const getExtension = (fileName = '') =>
  fileName.split('.').pop()?.toLowerCase() || ''

const getPreviewKind = (fileName, contentType = '') => {
  const type = contentType.toLowerCase()
  const extension = getExtension(fileName)

  if (type.includes('pdf') || extension === 'pdf') return 'pdf'
  if (
    type.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)
  ) {
    return 'image'
  }
  if (
    type.startsWith('text/') ||
    ['txt', 'csv', 'json', 'xml'].includes(extension)
  ) {
    return 'text'
  }
  if (
    type === OFFICE_MIME_TYPES.xlsx ||
    type === OFFICE_MIME_TYPES.xls ||
    ['xlsx', 'xls'].includes(extension)
  ) {
    return 'spreadsheet'
  }
  if (
    type === OFFICE_MIME_TYPES.docx ||
    type === OFFICE_MIME_TYPES.doc ||
    ['docx', 'doc'].includes(extension)
  ) {
    return 'word'
  }
  return 'unsupported'
}

const documentPageSx = {
  width: 'min(8.5in, calc(100vw - 48px))',
  minHeight: '11in',
  mx: 'auto',
  bgcolor: '#fff',
  color: '#111',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
  boxSizing: 'border-box'
}

const getSheetHtml = (workbook, sheetName) => {
  const sheet = workbook?.Sheets?.[sheetName]
  return sheet ? DOMPurify.sanitize(XLSX.utils.sheet_to_html(sheet)) : ''
}

const SpreadsheetPreview = ({
  html,
  sheetNames,
  selectedSheet,
  onSheetChange
}) => (
  <Box
    sx={{
      ...documentPageSx,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      height: 'calc(100vh - 112px)',
      overflow: 'hidden'
    }}
  >
    {sheetNames.length > 1 && (
      <Box
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'grey.100',
          flexShrink: 0
        }}
      >
        <Tabs
          value={selectedSheet}
          onChange={(_, value) => onSheetChange(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="spreadsheet sheets"
        >
          {sheetNames.map((sheetName) => (
            <Tab
              key={sheetName}
              value={sheetName}
              label={sheetName}
              sx={{ minHeight: 40, textTransform: 'none' }}
            />
          ))}
        </Tabs>
      </Box>
    )}
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        p: 2,
        '& table': {
          borderCollapse: 'collapse',
          fontSize: '0.875rem',
          width: 'max-content',
          minWidth: '100%'
        },
        '& td, & th': {
          border: '1px solid',
          borderColor: 'divider',
          px: 1,
          py: 0.5,
          whiteSpace: 'nowrap'
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  </Box>
)

SpreadsheetPreview.propTypes = {
  html: PropTypes.string.isRequired,
  sheetNames: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedSheet: PropTypes.string.isRequired,
  onSheetChange: PropTypes.func.isRequired
}

const DocumentPreviewDialog = ({
  open,
  onClose,
  parentType,
  parentID,
  document
}) => {
  const [objectUrl, setObjectUrl] = useState('')
  const [textContent, setTextContent] = useState('')
  const [spreadsheetHtml, setSpreadsheetHtml] = useState('')
  const [spreadsheetWorkbook, setSpreadsheetWorkbook] = useState(null)
  const [spreadsheetSheetNames, setSpreadsheetSheetNames] = useState([])
  const [selectedSpreadsheetSheet, setSelectedSpreadsheetSheet] = useState('')
  const [wordHtml, setWordHtml] = useState('')
  const [contentType, setContentType] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchDocument = useFetchDocument(parentType, parentID)
  const downloadDocument = useDownloadDocument(parentType, parentID)
  const fileName = useMemo(
    () => getDocumentDisplayName(document || {}),
    [document]
  )
  const documentId = document?.documentId
  const previewKind = getPreviewKind(fileName, contentType)

  useEffect(() => {
    if (!open || !documentId) return undefined

    let cancelled = false
    let nextObjectUrl = ''

    const loadPreview = async () => {
      setIsLoading(true)
      setError('')
      setTextContent('')
      setSpreadsheetHtml('')
      setSpreadsheetWorkbook(null)
      setSpreadsheetSheetNames([])
      setSelectedSpreadsheetSheet('')
      setWordHtml('')
      setContentType('')
      setObjectUrl('')

      try {
        const response = await fetchDocument(documentId)
        if (cancelled) return

        const blob = response.data
        const responseContentType =
          response.headers?.['content-type'] || blob.type || ''
        const kind = getPreviewKind(fileName, responseContentType)
        setContentType(responseContentType)

        if (['pdf', 'image'].includes(kind)) {
          nextObjectUrl = URL.createObjectURL(blob)
          setObjectUrl(nextObjectUrl)
        } else if (kind === 'text') {
          setTextContent(await blob.text())
        } else if (kind === 'spreadsheet') {
          const arrayBuffer = await blob.arrayBuffer()
          const workbook = XLSX.read(arrayBuffer, { type: 'array' })
          const firstSheetName = workbook.SheetNames[0]
          setSpreadsheetWorkbook(workbook)
          setSpreadsheetSheetNames(workbook.SheetNames)
          setSelectedSpreadsheetSheet(firstSheetName || '')
          setSpreadsheetHtml(getSheetHtml(workbook, firstSheetName))
        } else if (kind === 'word') {
          const extension = getExtension(fileName)
          const isDocx =
            extension === 'docx' ||
            responseContentType === OFFICE_MIME_TYPES.docx
          if (isDocx) {
            const arrayBuffer = await blob.arrayBuffer()
            const result = await mammoth.convertToHtml({ arrayBuffer })
            setWordHtml(DOMPurify.sanitize(result.value || ''))
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.data?.detail ||
              err?.message ||
              'Unable to load document preview.'
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadPreview()

    return () => {
      cancelled = true
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl)
    }
    // fetchDocument is recreated like the existing download helper; document
    // identity controls preview reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, fileName, open, parentID, parentType])

  const handleClose = () => {
    onClose()
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      setObjectUrl('')
    }
  }

  const handleDownload = () => {
    if (documentId) downloadDocument(documentId, fileName)
  }

  const handleSpreadsheetSheetChange = (sheetName) => {
    setSelectedSpreadsheetSheet(sheetName)
    setSpreadsheetHtml(getSheetHtml(spreadsheetWorkbook, sheetName))
  }

  const handleCanvasClick = (event) => {
    if (event.target === event.currentTarget) {
      handleClose()
    }
  }

  const renderPreview = () => {
    if (isLoading) {
      return (
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{ minHeight: 'calc(100vh - 96px)' }}
        >
          <CircularProgress />
        </Stack>
      )
    }

    if (error) {
      return <Alert severity="error">{error}</Alert>
    }

    if (previewKind === 'pdf' && objectUrl) {
      return (
        <Box
          component="iframe"
          src={objectUrl}
          title={fileName}
          sx={{
            border: 0,
            display: 'block',
            width: 'min(1024px, calc(100vw - 48px))',
            height: 'calc(100vh - 112px)',
            mx: 'auto',
            bgcolor: '#fff',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)'
          }}
        />
      )
    }

    if (previewKind === 'image' && objectUrl) {
      return (
        <Box
          component="img"
          src={objectUrl}
          alt={fileName}
          sx={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: 'calc(100vh - 112px)',
            mx: 'auto',
            objectFit: 'contain'
          }}
        />
      )
    }

    if (previewKind === 'text') {
      return (
        <Box
          component="pre"
          sx={{
            ...documentPageSx,
            m: 0,
            p: 6,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          {textContent}
        </Box>
      )
    }

    if (previewKind === 'spreadsheet' && spreadsheetHtml) {
      return (
        <SpreadsheetPreview
          html={spreadsheetHtml}
          sheetNames={spreadsheetSheetNames}
          selectedSheet={selectedSpreadsheetSheet}
          onSheetChange={handleSpreadsheetSheetChange}
        />
      )
    }

    if (previewKind === 'word' && wordHtml) {
      return (
        <Box
          sx={{
            ...documentPageSx,
            overflow: 'auto',
            p: 6,
            '& img': {
              maxWidth: '100%'
            },
            '& table': {
              borderCollapse: 'collapse',
              width: '100%'
            },
            '& td, & th': {
              border: '1px solid',
              borderColor: 'divider',
              p: 1
            }
          }}
          dangerouslySetInnerHTML={{ __html: wordHtml }}
        />
      )
    }

    if (previewKind === 'word') {
      return (
        <Alert severity="info">
          DOCX preview is available. Legacy DOC files cannot be previewed in the
          browser; download the file to view it in Word or LibreOffice.
        </Alert>
      )
    }

    return (
      <Alert severity="info">
        Preview is not available for this file type. Download the file to view
        it in its original application.
      </Alert>
    )
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen
      BackdropProps={{
        sx: {
          bgcolor: 'rgba(0, 0, 0, 0.72)'
        }
      }}
      PaperProps={{
        sx: {
          bgcolor: 'transparent !important',
          backgroundImage: 'none',
          boxShadow: 'none'
        }
      }}
      sx={{
        bgcolor: 'transparent',
        '& .MuiDialog-container': {
          bgcolor: 'transparent'
        },
        '& .MuiDialog-paper': {
          bgcolor: 'transparent !important',
          backgroundImage: 'none'
        },
        '& .MuiBackdrop-root': {
          bgcolor: 'rgba(0, 0, 0, 0.72)',
          backdropFilter: 'none'
        }
      }}
    >
      <DialogTitle
        sx={{
          height: 56,
          px: 2,
          py: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          bgcolor: 'rgba(16, 18, 20, 0.92)',
          color: '#fff'
        }}
      >
        <BCTypography
          variant="subtitle2"
          component="span"
          sx={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'inherit'
          }}
          title={fileName}
        >
          {fileName || 'Document preview'}
        </BCTypography>
        <Stack direction="row" spacing={1} alignItems="center">
          <BCButton
            variant="outlined"
            color="light"
            size="small"
            startIcon={<Download fontSize="small" />}
            onClick={handleDownload}
            disabled={!documentId}
            data-test="document-preview-download"
          >
            Download
          </BCButton>
          <IconButton
            aria-label="close preview"
            onClick={handleClose}
            sx={{ color: '#fff' }}
          >
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent
        onClick={handleCanvasClick}
        sx={{
          p: 3,
          height: 'calc(100vh - 56px)',
          overflow: 'auto',
          bgcolor: 'transparent'
        }}
      >
        <Box
          onClick={(event) => event.stopPropagation()}
          sx={{
            width: 'fit-content',
            maxWidth: '100%',
            mx: 'auto'
          }}
        >
          {renderPreview()}
        </Box>
      </DialogContent>
    </Dialog>
  )
}

DocumentPreviewDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  parentType: PropTypes.string.isRequired,
  parentID: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    .isRequired,
  document: PropTypes.object
}

export default DocumentPreviewDialog
