import { forwardRef } from 'react'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { faFileExcel } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CircularProgress } from '@mui/material'

interface DownloadButtonProps {
  onDownload: () => void
  isDownloading: boolean
  label: string
  downloadLabel: string
  dataTest: string
}

export const DownloadButton = forwardRef<HTMLButtonElement, DownloadButtonProps>(({
  onDownload,
  isDownloading,
  label,
  downloadLabel,
  dataTest
}, ref) => (
  <BCButton
    ref={ref}
    data-test={dataTest}
    variant="outlined"
    size="small"
    color="primary"
    sx={{ whiteSpace: 'nowrap' }}
    startIcon={
      isDownloading ? (
        <CircularProgress size={24} />
      ) : (
        <FontAwesomeIcon icon={faFileExcel} className="small-icon" />
      )
    }
    onClick={onDownload}
    disabled={isDownloading}
  >
    <BCTypography variant="subtitle2">
      {isDownloading ? downloadLabel : label}
    </BCTypography>
  </BCButton>
))

DownloadButton.displayName = 'DownloadButton'
