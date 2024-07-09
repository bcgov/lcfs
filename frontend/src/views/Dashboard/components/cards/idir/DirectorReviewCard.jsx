import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Stack, List, ListItemButton } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import withRole from '@/utils/withRole'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useDirectorReviewCounts } from '@/hooks/useDashboard'

const DirectorReviewCard = () => {
  const { t } = useTranslation(['common', 'dashboard'])
  const navigate = useNavigate()
  const { data: counts, isLoading } = useDirectorReviewCounts()

  const handleNavigation = (route, transactionType, status) => {
    const filters = [
      { field: "transactionType", filterType: "text", type: "contains", filter: transactionType },
      { field: 'status', filterType: 'text', type: 'equals', filter: status },
    ]
    navigate(route, { state: { filters } })
  }

  const handleComplianceNavigation = (route, status) => {
    const filters = [
      { field: "status", filterType: "text", type: "equals", filter: status }
    ]
    navigate(route, { state: { filters } })
  }

  return (
    <BCWidgetCard
      component="div"
      title={t('dashboard:directorReview.title')}
      content={
        isLoading ? (
          <Loading message={t('dashboard:directorReview.loadingMessage')} />
        ) : (
          <Stack spacing={2}>
            <BCTypography variant="body1">{t('dashboard:directorReview.thereAre')}</BCTypography>
            <List component="div" sx={{ maxWidth: '100%' }}>
              <ListItemButton
                component="a"
                onClick={() => handleNavigation(ROUTES.TRANSACTIONS, 'Transfer', 'Recommended')}
              >
                <BCTypography
                  variant="subtitle2"
                  color="link"
                  sx={{
                    textDecoration: 'underline',
                    '&:hover': { color: 'info.main' }
                  }}
                >
                  {t('dashboard:directorReview.transfersForReview', { count: counts?.transfers || 0 })}
                </BCTypography>
              </ListItemButton>
              <ListItemButton
                component="a"
                onClick={() => handleComplianceNavigation(ROUTES.REPORTS, 'Recommended_by_manager')}
              >
                <BCTypography
                  variant="subtitle2"
                  color="link"
                  sx={{
                    textDecoration: 'underline',
                    '&:hover': { color: 'info.main' }
                  }}
                >
                  {t('dashboard:directorReview.complianceReportsForReview', { count: counts?.complianceReports || 0 })}
                </BCTypography>
              </ListItemButton>
              <ListItemButton
                component="a"
                onClick={() => handleNavigation(ROUTES.TRANSACTIONS, 'InitiativeAgreement', 'Reviewed')}
              >
                <BCTypography
                  variant="subtitle2"
                  color="link"
                  sx={{
                    textDecoration: 'underline',
                    '&:hover': { color: 'info.main' }
                  }}
                >
                  {t('dashboard:directorReview.initiativeAgreementsForReview', { count: counts?.initiativeAgreements || 0 })}
                </BCTypography>
              </ListItemButton>
              <ListItemButton
                component="a"
                onClick={() => handleNavigation(ROUTES.TRANSACTIONS, 'AdminAdjustment', 'Recommended')}
              >
                <BCTypography
                  variant="subtitle2"
                  color="link"
                  sx={{
                    textDecoration: 'underline',
                    '&:hover': { color: 'info.main' }
                  }}
                >
                  {t('dashboard:directorReview.adminAdjustmentsForReview', { count: counts?.adminAdjustments || 0 })}
                </BCTypography>
              </ListItemButton>
            </List>
          </Stack>
        )
      }
    />
  )
}

const AllowedRoles = [roles.director]
const DirectorReviewWidgetWithRole = withRole(DirectorReviewCard, AllowedRoles)

export default DirectorReviewWidgetWithRole