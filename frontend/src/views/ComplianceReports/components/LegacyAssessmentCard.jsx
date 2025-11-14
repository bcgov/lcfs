import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { StyledListItem } from '@/components/StyledListItem'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { constructAddress } from '@/utils/constructAddress'
import { List, ListItemText, Stack } from '@mui/material'
import Box from '@mui/material/Box'
import { useTranslation } from 'react-i18next'
import { CONFIG } from '@/constants/config'
import { HistoryCard } from '@/views/ComplianceReports/components/HistoryCard.jsx'
import { Assignment } from '@mui/icons-material'

export const LegacyAssessmentCard = ({
  orgData,
  hasSupplemental,
  isGovernmentUser,
  currentStatus,
  legacyReportId,
  chain
}) => {
  const { t } = useTranslation(['report'])

  const viewLegacyReport = () => {
    window.open(
      `${CONFIG.TFRS_BASE}/compliance_reporting/edit/${legacyReportId}/intro`,
      '_blank'
    )
  }
  return (
    <BCWidgetCard
      component="div"
      title={
        currentStatus === COMPLIANCE_REPORT_STATUSES.ASSESSED ||
        isGovernmentUser ||
        hasSupplemental
          ? t('report:assessment')
          : t('report:orgDetails')
      }
      content={
        <>
          <Stack direction="column" spacing={0.5}>
            <BCTypography variant="h6" color="primary">
              {orgData?.name}
            </BCTypography>
            <List sx={{ padding: 0 }}>
              <StyledListItem>
                <ListItemText primaryTypographyProps={{ variant: 'body4' }}>
                  {t('report:serviceAddrLabel')}:
                  {orgData && constructAddress(orgData.orgAddress)}
                </ListItemText>
              </StyledListItem>
              <StyledListItem>
                <ListItemText primaryTypographyProps={{ variant: 'body4' }}>
                  {t('report:bcAddrLabel')}:{' '}
                  {orgData && constructAddress(orgData.orgAttorneyAddress)}
                </ListItemText>
              </StyledListItem>
            </List>

            {!isGovernmentUser && (
              <BCTypography
                component="div"
                variant="body4"
                dangerouslySetInnerHTML={{
                  __html: t('report:contactForAddrChange')
                }}
              />
            )}
            {!!chain.length && (
              <>
                <BCTypography
                  sx={{ paddingTop: '16px' }}
                  component="div"
                  variant="h6"
                  color="primary"
                >
                  {t('report:reportHistory')}
                </BCTypography>
                {chain.map((report) => (
                  <HistoryCard key={report.version} report={report} />
                ))}
              </>
            )}

            <BCTypography
              sx={{ paddingTop: '16px' }}
              component="div"
              variant="body4"
            >
              {t('report:supplementalWarning')}
            </BCTypography>
            {legacyReportId && (
              <Box>
                <BCButton
                  data-test="view-legacy"
                  size="small"
                  className="svg-icon-button"
                  variant="contained"
                  color="primary"
                  startIcon={<Assignment />}
                  sx={{ mt: 2 }}
                  onClick={viewLegacyReport}
                >
                  {t('report:viewLegacyBtn')}
                </BCButton>
              </Box>
            )}
          </Stack>
        </>
      }
    />
  )
}
