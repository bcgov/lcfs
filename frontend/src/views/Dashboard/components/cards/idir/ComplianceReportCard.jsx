import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import Loading from '@/components/Loading'
import { FILTER_KEYS } from '@/constants/common'
import { ROUTES } from '@/routes/routes'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { useComplianceReportCounts } from '@/hooks/useDashboard'
import { List, ListItemButton, Stack } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

const CountDisplay = ({ count }) => (
  <BCTypography
    component="span"
    variant="h3"
    sx={{
      color: 'success.main',
      marginX: 3
    }}
  >
    {count}
  </BCTypography>
)

export const ComplianceReportCard = () => {
  const { t } = useTranslation(['dashboard'])
  const navigate = useNavigate()
  const { data: counts, isLoading } = useComplianceReportCounts()

  const handleNavigation = () => {
    const filter = {
      status: {
        filterType: 'set',
        type: 'set',
        filter: [
          COMPLIANCE_REPORT_STATUSES.SUBMITTED,
          COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST,
          COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER,
          COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT
        ]
      }
    }
    sessionStorage.setItem(FILTER_KEYS.COMPLIANCE_REPORT_GRID, JSON.stringify(filter))
    navigate(ROUTES.REPORTS.LIST)
  }

  const renderLinkWithCount = (text, count, onClick) => {
    return (
      <>
        {count != null && <CountDisplay count={count} />}
        <BCTypography
          variant="body2"
          color="link"
          sx={{
            textDecoration: 'underline',
            '&:hover': { color: 'info.main' }
          }}
          onClick={onClick}
        >
          {text}
        </BCTypography>
      </>
    )
  }

  return (
    <BCWidgetCard
      component="div"
      disableHover={true}
      title={t('dashboard:complianceReports.title')}
      sx={{ '& .MuiCardContent-root': { padding: '16px' } }}
      content={
        isLoading ? (
          <Loading message={t('dashboard:complianceReports.loadingMessage')} />
        ) : (
          <Stack spacing={1}>
            <BCTypography variant="body2" sx={{ marginBottom: 0 }}>
              {t('dashboard:complianceReports.thereAre')}
            </BCTypography>
            <List
              component="div"
              sx={{
                maxWidth: '100%',
                padding: 0,
                '& .MuiListItemButton-root': {
                  padding: '2px 0'
                }
              }}
            >
              <ListItemButton component="a" onClick={handleNavigation}>
                {renderLinkWithCount(
                  t('dashboard:complianceReports.crInProgress'),
                  counts?.pendingReviews || 0,
                  handleNavigation
                )}
              </ListItemButton>
            </List>
          </Stack>
        )
      }
    />
  )
}
