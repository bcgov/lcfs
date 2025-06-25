import { forwardRef } from 'react'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { faFileExcel } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CircularProgress } from '@mui/material'

export const DownloadButton = forwardRef(
  ({ onDownload, isDownloading, label, downloadLabel, dataTest }, ref) => (
    <BCButton
      ref={ref}
      data-test={dataTest}
      variant="outlined"
      size="small"
      color="primary"
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
  )
)
