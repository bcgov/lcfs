import { useState } from 'react'
import PropTypes from 'prop-types'
import ButtonBase from '@mui/material/ButtonBase'
import { useTranslation } from 'react-i18next'

import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import DocumentPreviewButton from '@/components/Documents/DocumentPreviewButton'
import { getDocumentDisplayName } from '@/utils/documents'
import { getCommentErrorMessage } from './commentErrors'

const formatUploadDate = (raw) => {
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/** Shared attachment display for entity comment threads and the Comment Log. */
const CommentAttachments = ({ commentId, documents, onDownload }) => {
  const { t } = useTranslation(['internalComment'])
  const [downloadingId, setDownloadingId] = useState(null)
  const [downloadError, setDownloadError] = useState(null)

  const download = async (document) => {
    setDownloadError(null)
    setDownloadingId(document.documentId)
    try {
      await onDownload(document.documentId, getDocumentDisplayName(document))
    } catch (error) {
      setDownloadError(error)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <>
      <BCBox
        component="ul"
        aria-label={t('internalComment:attachments')}
        data-test="comment-attachments"
        sx={{
          listStyle: 'none',
          p: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          mt: 0.5
        }}
      >
        {documents.map((document) => {
          const fileName = getDocumentDisplayName(document)
          return (
            <BCBox
              key={document.documentId}
              component="li"
              sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
            >
              <DocumentPreviewButton
                parentType="internal_comment"
                parentID={commentId}
                document={document}
              />
              <ButtonBase
                type="button"
                onClick={() => download(document)}
                disabled={!onDownload || downloadingId !== null}
                aria-busy={downloadingId === document.documentId}
                aria-label={`${t('internalComment:downloadAttachment')}: ${fileName}`}
                sx={{
                  color: '#003366',
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 24,
                  typography: 'body2',
                  textAlign: 'left',
                  textDecoration: 'underline'
                }}
              >
                {fileName}
              </ButtonBase>
              <BCTypography variant="caption" component="div">
                {t('internalComment:uploadedBy', {
                  name: document.createUser || '—',
                  date: document.createDate
                    ? formatUploadDate(document.createDate)
                    : '—'
                })}
              </BCTypography>
            </BCBox>
          )
        })}
      </BCBox>
      {downloadError && (
        <BCAlert severity="error" role="alert">
          {t('internalComment:attachmentDownloadError')}{' '}
          {getCommentErrorMessage(downloadError)}
        </BCAlert>
      )}
    </>
  )
}

CommentAttachments.propTypes = {
  commentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    .isRequired,
  documents: PropTypes.arrayOf(
    PropTypes.shape({
      documentId: PropTypes.number.isRequired,
      fileName: PropTypes.string.isRequired,
      displayName: PropTypes.string,
      createUser: PropTypes.string,
      createDate: PropTypes.string
    })
  ).isRequired,
  onDownload: PropTypes.func
}

export default CommentAttachments
