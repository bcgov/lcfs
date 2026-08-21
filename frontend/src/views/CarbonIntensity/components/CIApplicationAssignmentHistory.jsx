import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { formatDateWithTimezoneAbbr } from '@/utils/formatters'
import { Divider } from '@mui/material'
import { useTranslation } from 'react-i18next'

const analystName = (analyst, unassignedLabel) =>
  analyst?.fullName || unassignedLabel

export const CIApplicationAssignmentHistory = ({ assignmentHistory }) => {
  const { t } = useTranslation(['carbonIntensity'])
  const unassignedLabel = t('carbonIntensity:summary.unassigned')

  const fallbackEvent = t('carbonIntensity:summary.assignmentChanged')
  const formatAssignmentHistoryEntry = (entry) => ({
    event: entry.event
      ? t(
          `carbonIntensity:summary.assignmentEvents.${entry.event}`,
          fallbackEvent
        )
      : fallbackEvent,
    previousName: analystName(entry.previousAnalyst, unassignedLabel),
    newName: analystName(entry.newAnalyst, unassignedLabel),
    changedAt: formatDateWithTimezoneAbbr(entry.changedAt),
    changedBy: entry.changedBy
  })

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
            {assignmentHistory.map((entry, index) => {
              const line = formatAssignmentHistoryEntry(entry)
              return (
                <li
                  key={`${entry.changedAt}-${index}`}
                  style={{ marginLeft: 10 }}
                  data-test="ci-summary-assignment-history-row"
                >
                  <BCTypography variant="body2" component="div">
                    <strong>{line.event}</strong>
                    {` from `}
                    <strong>{line.previousName}</strong>
                    {` to `}
                    <strong>{line.newName}</strong>
                    {` on `}
                    {line.changedAt}
                    {` by `}
                    <strong>{line.changedBy}</strong>
                  </BCTypography>
                </li>
              )
            })}
          </ul>
        </BCBox>
      </BCBox>
      <Divider sx={{ mb: 2 }} data-test="ci-assignment-history-divider" />
    </>
  )
}

CIApplicationAssignmentHistory.displayName = 'CIApplicationAssignmentHistory'

export default CIApplicationAssignmentHistory
