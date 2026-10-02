import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { formatDateWithTimezoneAbbr } from '@/utils/formatters'
import { Divider, Stack } from '@mui/material'
import { useTranslation } from 'react-i18next'

export const CIApplicationReturnHistory = ({
  returnHistory,
  highlightPending = false
}) => {
  const { t } = useTranslation(['carbonIntensity'])

  if (!Array.isArray(returnHistory) || returnHistory.length === 0) {
    return null
  }

  return (
    <>
      <BCBox mt={2} data-test="ci-summary-return-history">
        <Stack spacing={1.5} sx={{ mt: 2, mb: 2 }}>
          {returnHistory.map((entry, index) => (
            <BCBox
              key={`${entry.changedAt}-${index}`}
              data-test="ci-summary-return-history-row"
              data-pending-return={highlightPending ? 'true' : 'false'}
              sx={{
                border: 1,
                borderLeft: highlightPending ? 4 : 1,
                borderColor: highlightPending ? 'grey.600' : 'grey.300',
                bgcolor: highlightPending ? 'grey.50' : 'background.paper',
                borderRadius: 1,
                px: 2,
                py: 1.5
              }}
            >
              <BCTypography
                variant="body2"
                component="div"
                sx={{ color: 'text.primary' }}
              >
                <strong>
                  {t('carbonIntensity:summary.returnedToFirstVerification')}
                </strong>
                {` on `}
                {formatDateWithTimezoneAbbr(entry.changedAt)}
                {entry.changedBy ? (
                  <>
                    {` by `}
                    <strong>{entry.changedBy}</strong>
                  </>
                ) : null}
              </BCTypography>
              <BCBox
                sx={{
                  mt: 1,
                  bgcolor: 'grey.50',
                  border: 1,
                  borderColor: 'grey.300',
                  borderRadius: 1,
                  px: 1.5,
                  py: 1
                }}
              >
                <BCTypography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {entry.returnReason}
                </BCTypography>
              </BCBox>
            </BCBox>
          ))}
        </Stack>
      </BCBox>
      <Divider sx={{ mb: 2 }} data-test="ci-return-history-divider" />
    </>
  )
}

CIApplicationReturnHistory.displayName = 'CIApplicationReturnHistory'

export default CIApplicationReturnHistory
