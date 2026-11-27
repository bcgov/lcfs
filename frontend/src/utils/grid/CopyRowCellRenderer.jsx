import { Alert, IconButton, Snackbar } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy } from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { copyToClipboard } from '@/utils/clipboard'
import { getRowCopyText } from './copyRowText'

export const CopyRowCellRenderer = (params) => {
  const { t } = useTranslation('common')
  const [copyStatus, setCopyStatus] = useState(null)

  const handleCopy = async (event) => {
    event.preventDefault()
    event.stopPropagation()

    const copyText = getRowCopyText(params)
    if (!copyText) return

    try {
      const copied = await copyToClipboard(copyText)
      setCopyStatus({
        message: copied
          ? t('rowCopied', 'Row copied')
          : t('copyRowFailed', 'Could not copy row'),
        severity: copied ? 'success' : 'error'
      })
    } catch {
      setCopyStatus({
        message: t('copyRowFailed', 'Could not copy row'),
        severity: 'error'
      })
    }
  }

  return (
    <>
      <IconButton
        aria-label={t('copyRow', 'Copy row')}
        title={t('copyRow', 'Copy row')}
        size="small"
        onClick={handleCopy}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <FontAwesomeIcon icon={faCopy} />
      </IconButton>
      <Snackbar
        open={Boolean(copyStatus)}
        autoHideDuration={3000}
        onClose={() => setCopyStatus(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {copyStatus ? (
          <Alert
            severity={copyStatus.severity}
            role="status"
            onClose={() => setCopyStatus(null)}
          >
            {copyStatus.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  )
}
