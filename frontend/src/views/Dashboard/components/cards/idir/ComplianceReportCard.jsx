import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import Loading from '@/components/Loading'
import { FILTER_KEYS } from '@/constants/common'
import { ROUTES } from '@/routes/routes'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { useComplianceReportCounts } from '@/hooks/useDashboard'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import Stack from '@mui/material/Stack'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { CountDisplay } from '../../CountDisplay'
import { countDigits } from '../../countDigits'

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
    sessionStorage.setItem(
      FILTER_KEYS.COMPLIANCE_REPORT_GRID,
      JSON.stringify(filter)
    )
    navigate(ROUTES.REPORTS.LIST)
  }

  const pendingReviews = counts?.pendingReviews || 0
  const digits = countDigits(pendingReviews)

  const renderLinkWithCount = (text, count, onClick) => {
    return (
      <>
        <CountDisplay count={count} digits={digits} hidden={count == null} />
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
                  pendingReviews,
                  handleNavigation
                )}
              </ListItemButton>
              <ListItemButton
                component="a"
                onClick={() => navigate(ROUTES.CREDIT_CALCULATOR)}
              >
                <CountDisplay digits={digits} hidden />
                <BCTypography
                  variant="body2"
                  color="link"
                  sx={{
                    textDecoration: 'underline',
                    '&:hover': { color: 'info.main' }
                  }}
                  onClick={() => navigate(ROUTES.CREDIT_CALCULATOR)}
                >
                  {t('report:calcTitle')}
                </BCTypography>
              </ListItemButton>
            </List>
          </Stack>
        )
      }
    />
  )
}
