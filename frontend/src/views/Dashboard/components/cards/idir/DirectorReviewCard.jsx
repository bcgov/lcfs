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
      color: 'success.main',
      marginX: 3
    }}
  >
    {count}
  </BCTypography>
)

const DirectorReviewCard = () => {
  const { t } = useTranslation(['dashboard'])
  const navigate = useNavigate()
  const { data: counts, isLoading } = useDirectorReviewCounts()

  const handleNavigation = (route, transactionType, status) => {
    const filters = [
      {
        field: 'transactionType',
        filterType: 'text',
        type: 'contains',
        filter: transactionType
      },
      { field: 'status', filterType: 'text', type: 'equals', filter: status }
    ]
    navigate(route, { state: { filters } })
  }

  const handleComplianceNavigation = (route, status) => {
    const filters = [
      { field: 'status', filterType: 'text', type: 'equals', filter: status }
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
      title={t('dashboard:directorReview.title')}
      sx={{ '& .MuiCardContent-root': { padding: '16px' } }} // Reduce padding of the card content
      content={
        isLoading ? (
          <Loading message={t('dashboard:directorReview.loadingMessage')} />
        ) : (
          <Stack spacing={1}>
            <BCTypography variant="body2" sx={{ marginBottom: 0 }}>
              {t('dashboard:directorReview.thereAre')}
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
              <ListItemButton
                component="a"
                onClick={() =>
                  handleNavigation(
                    ROUTES.TRANSACTIONS,
                    'Transfer',
                    'Recommended'
                  )
                }
              >
                {renderLinkWithCount(
                  t('dashboard:directorReview.transfersForReview'),
                  counts?.transfers || 0,
                  () =>
                    handleNavigation(
                      ROUTES.TRANSACTIONS,
                      'Transfer',
                      'Recommended'
                    )
                )}
              </ListItemButton>
              <ListItemButton
                component="a"
                onClick={() =>
                  handleComplianceNavigation(
                    ROUTES.REPORTS,
                    'Recommended by manager'
                  )
                }
              >
                {renderLinkWithCount(
                  t('dashboard:directorReview.complianceReportsForReview'),
                  counts?.complianceReports || 0,
                  () =>
                    handleComplianceNavigation(
                      ROUTES.REPORTS,
                      'Recommended by manager'
                    )
                )}
              </ListItemButton>
              <ListItemButton
                component="a"
                onClick={() =>
                  handleNavigation(
                    ROUTES.TRANSACTIONS,
                    'InitiativeAgreement',
                    'Recommended'
                  )
                }
              >
                {renderLinkWithCount(
                  t('dashboard:directorReview.initiativeAgreementsForReview'),
                  counts?.initiativeAgreements || 0,
                  () =>
                    handleNavigation(
                      ROUTES.TRANSACTIONS,
                      'InitiativeAgreement',
                      'Recommended'
                    )
                )}
              </ListItemButton>
              <ListItemButton
                component="a"
                onClick={() =>
                  handleNavigation(
                    ROUTES.TRANSACTIONS,
                    'AdminAdjustment',
                    'Recommended'
                  )
                }
              >
                {renderLinkWithCount(
                  t('dashboard:directorReview.adminAdjustmentsForReview'),
                  counts?.adminAdjustments || 0,
                  () =>
                    handleNavigation(
                      ROUTES.TRANSACTIONS,
                      'AdminAdjustment',
                      'Recommended'
                    )
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
