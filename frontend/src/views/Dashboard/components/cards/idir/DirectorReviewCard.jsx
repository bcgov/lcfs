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

const CountDisplay = ({ count }) => (
  <BCTypography
    component="span"
    variant="h3"
    sx={{
      fontWeight: 'bold',
      color: 'success.main',
      marginRight: 3
    }}
  >
    {count}
  </BCTypography>
)

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

  const renderLinkWithCount = (text, count, onClick) => {
    return (
      <>
        <CountDisplay count={count} />
        <BCTypography
          variant="body2"
          color="link"
          sx={{
            textDecoration: 'underline',
            '&:hover': { color: 'info.main' },
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
      title={t('dashboard:directorReview.title')}
      sx={{ '& .MuiCardContent-root': { padding: '16px' } }} // Reduce padding of the card content
      content={
        isLoading ? (
          <Loading message={t('dashboard:directorReview.loadingMessage')} />
        ) : (
          <Stack spacing={1}>
            <BCTypography variant="body1" sx={{ marginBottom: 0 }}>{t('dashboard:directorReview.thereAre')}</BCTypography>
            <List 
              component="div" 
              sx={{ 
                maxWidth: '100%', 
                padding: 0,
                '& .MuiListItemButton-root': {
                  padding: '2px 0',
                  marginLeft: 2
                },
              }}
            >
              <ListItemButton
                component="a"
                onClick={() => handleNavigation(ROUTES.TRANSACTIONS, 'Transfer', 'Recommended')}
              >
                {renderLinkWithCount(
                  t('dashboard:directorReview.transfersForReview', { count: counts?.transfers || 0 }),
                  counts?.transfers || 0,
                  () => handleNavigation(ROUTES.TRANSACTIONS, 'Transfer', 'Recommended')
                )}
              </ListItemButton>
              <ListItemButton
                component="a"
                onClick={() => handleComplianceNavigation(ROUTES.REPORTS, 'Recommended_by_manager')}
              >
                {renderLinkWithCount(
                  t('dashboard:directorReview.complianceReportsForReview', { count: counts?.complianceReports || 0 }),
                  counts?.complianceReports || 0,
                  () => handleComplianceNavigation(ROUTES.REPORTS, 'Recommended_by_manager')
                )}
              </ListItemButton>
              <ListItemButton
                component="a"
                onClick={() => handleNavigation(ROUTES.TRANSACTIONS, 'InitiativeAgreement', 'Reviewed')}
              >
                {renderLinkWithCount(
                  t('dashboard:directorReview.initiativeAgreementsForReview', { count: counts?.initiativeAgreements || 0 }),
                  counts?.initiativeAgreements || 0,
                  () => handleNavigation(ROUTES.TRANSACTIONS, 'InitiativeAgreement', 'Reviewed')
                )}
              </ListItemButton>
              <ListItemButton
                component="a"
                onClick={() => handleNavigation(ROUTES.TRANSACTIONS, 'AdminAdjustment', 'Recommended')}
              >
                {renderLinkWithCount(
                  t('dashboard:directorReview.adminAdjustmentsForReview', { count: counts?.adminAdjustments || 0 }),
                  counts?.adminAdjustments || 0,
                  () => handleNavigation(ROUTES.TRANSACTIONS, 'AdminAdjustment', 'Recommended')
                )}
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