import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { faFileExcel } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CircularProgress } from '@mui/material'

export const DownloadButton = ({
  onDownload,
  isDownloading,
  label,
  downloadLabel,
  dataTest
}) => (
  <BCButton
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
)
