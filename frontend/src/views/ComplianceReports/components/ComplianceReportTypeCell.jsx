import Tooltip from '@mui/material/Tooltip'
import WarningIcon from '@mui/icons-material/Warning'
import { Link, useLocation } from 'react-router-dom'

export const ComplianceReportTypeCell = ({ data, isSupplier = false }) => {
  const location = useLocation()
  const reportType = data.reportType || ''

  const hasDraftSupplementalOverThirtyDays = () => {
    if (isSupplier || !data.latestSupplementalCreateDate) return false
    if (data.isLatest !== false || data.latestStatus !== 'Draft') return false
    if (data.latestSupplementalHasBeenSubmitted) return false

    const createDate = new Date(data.latestSupplementalCreateDate)
    const now = new Date()
    const daysDiff = Math.floor((now - createDate) / (1000 * 60 * 60 * 24))
    return daysDiff > 30
  }

  const showFlag = hasDraftSupplementalOverThirtyDays()
  const targetUrl = `${location.pathname}/${data.compliancePeriod}/${data.complianceReportId}`

  return (
    <Link to={targetUrl} style={{ color: '#000', textDecoration: 'none' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          height: '100%'
        }}
      >
        {showFlag && (
          <Tooltip
            title="Supplemental draft over 30 days old"
            arrow
            placement="top"
          >
            <WarningIcon
              fontSize="medium"
              data-testid="warning-icon"
              sx={{ color: '#ff0000' }}
            />
          </Tooltip>
        )}
        <span>{reportType}</span>
      </div>
    </Link>
  )
}
