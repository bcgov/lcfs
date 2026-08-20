import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { formatDateWithTimezoneAbbr } from '@/utils/formatters'
import { Divider } from '@mui/material'
import { useTranslation } from 'react-i18next'

export const CIApplicationAssignmentHistory = ({ assignmentHistory }) => {
  const { t } = useTranslation(['carbonIntensity'])

  if (!Array.isArray(assignmentHistory) || assignmentHistory.length === 0) {
    return null
  }

  return (
    <>
      <BCBox mt={2} data-test="ci-summary-assignment-history">
        <BCTypography variant="h6" color="primary">
          {t('carbonIntensity:summary.assignmentHistoryHeader')}
        </BCTypography>
        <BCBox m={2}>
          <ul>
            {assignmentHistory.map((entry, index) => (
              <li
                key={`${entry.changedAt}-${index}`}
                style={{ marginLeft: 10 }}
                data-test="ci-summary-assignment-history-row"
              >
                <BCTypography variant="body2" component="div">
                  <strong>
                    {t(
                      `carbonIntensity:summary.assignmentEvents.${entry.event}`,
                      t('carbonIntensity:summary.assignmentChanged')
                    )}
                  </strong>
                  <span> from </span>
                  <strong>
                    {entry.previousAnalyst?.fullName ||
                      t('carbonIntensity:summary.unassigned')}
                  </strong>
                  <span> to </span>
                  <strong>
                    {entry.newAnalyst?.fullName ||
                      t('carbonIntensity:summary.unassigned')}
                  </strong>
                  <span> on </span>
                  {formatDateWithTimezoneAbbr(entry.changedAt)}
                  <span> by </span>
                  <strong>{entry.changedBy}</strong>
                </BCTypography>
              </li>
            ))}
          </ul>
        </BCBox>
      </BCBox>
      <Divider sx={{ mb: 2 }} data-test="ci-assignment-history-divider" />
    </>
  )
}

CIApplicationAssignmentHistory.displayName = 'CIApplicationAssignmentHistory'

export default CIApplicationAssignmentHistory
