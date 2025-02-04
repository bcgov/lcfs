import React, { useCallback, useMemo } from 'react'
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

// Separate reusable components
// eslint-disable-next-line react/display-name
const CountDisplay = React.memo(({ count }) => (
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
))

// Constants for filter configurations
const FILTER_CONFIGS = {
  transfers: {
    route: ROUTES.TRANSACTIONS,
    gridKey: 'transactions-grid-filter',
    filter: JSON.stringify({
      transactionType: {
        filterType: 'text',
        type: 'equals',
        filter: 'Transfer'
      },
      status: { filterType: 'text', type: 'equals', filter: 'Recommended' }
    })
  },
  complianceReports: {
    route: ROUTES.REPORTS,
    gridKey: 'compliance-reports-grid-filter',
    filter: JSON.stringify({
      status: {
        filterType: 'text',
        type: 'equals',
        filter: 'Recommended by manager'
      }
    })
  },
  initiativeAgreements: {
    route: ROUTES.TRANSACTIONS,
    gridKey: 'transactions-grid-filter',
    filter: JSON.stringify({
      transactionType: {
        filterType: 'text',
        type: 'equals',
        filter: 'Initiative Agreement'
      },
      status: { filterType: 'text', type: 'equals', filter: 'Recommended' }
    })
  },
  adminAdjustments: {
    route: ROUTES.TRANSACTIONS,
    gridKey: 'transactions-grid-filter',
    filter: JSON.stringify({
      transactionType: {
        filterType: 'text',
        type: 'equals',
        filter: 'Admin Adjustment'
      },
      status: { filterType: 'text', type: 'equals', filter: 'Recommended' }
    })
  }
}

// Styles object for better organization
const styles = {
  cardContent: {
    '& .MuiCardContent-root': {
      padding: '16px'
    }
  },
  list: {
    maxWidth: '100%',
    padding: 0,
    '& .MuiListItemButton-root': {
      padding: '2px 0'
    }
  },
  link: {
    textDecoration: 'underline',
    '&:hover': {
      color: 'info.main'
    }
  }
}

const DirectorReviewCard = () => {
  const { t } = useTranslation(['dashboard'])
  const navigate = useNavigate()
  const { data: counts = {}, isLoading } = useDirectorReviewCounts()

  const handleNavigation = useCallback(
    (config) => {
      localStorage.setItem(config.gridKey, config.filter)
      navigate(config.route)
    },
    [navigate]
  )

  const renderLinkWithCount = useCallback(
    (text, count, onClick) => (
      <>
        <CountDisplay count={count} />
        <BCTypography
          variant="body2"
          color="link"
          sx={styles.link}
          onClick={onClick}
        >
          {text}
        </BCTypography>
      </>
    ),
    []
  )

  const reviewItems = useMemo(
    () => [
      {
        key: 'transfers',
        text: t('dashboard:directorReview.transfersForReview'),
        count: counts.transfers || 0,
        config: FILTER_CONFIGS.transfers
      },
      {
        key: 'complianceReports',
        text: t('dashboard:directorReview.complianceReportsForReview'),
        count: counts.complianceReports || 0,
        config: FILTER_CONFIGS.complianceReports
      },
      {
        key: 'initiativeAgreements',
        text: t('dashboard:directorReview.initiativeAgreementsForReview'),
        count: counts.initiativeAgreements || 0,
        config: FILTER_CONFIGS.initiativeAgreements
      },
      {
        key: 'adminAdjustments',
        text: t('dashboard:directorReview.adminAdjustmentsForReview'),
        count: counts.adminAdjustments || 0,
        config: FILTER_CONFIGS.adminAdjustments
      }
    ],
    [t, counts]
  )

  if (isLoading) {
    return (
      <BCWidgetCard
        component="div"
        title={t('dashboard:directorReview.title')}
        sx={styles.cardContent}
        content={
          <Loading message={t('dashboard:directorReview.loadingMessage')} />
        }
      />
    )
  }

  return (
    <BCWidgetCard
      component="div"
      title={t('dashboard:directorReview.title')}
      sx={styles.cardContent}
      content={
        <Stack spacing={1}>
          <BCTypography variant="body2" sx={{ marginBottom: 0 }}>
            {t('dashboard:directorReview.thereAre')}
          </BCTypography>
          <List component="div" sx={styles.list}>
            {reviewItems.map(({ key, text, count, config }) => (
              <ListItemButton
                key={key}
                component="a"
                onClick={() => handleNavigation(config)}
              >
                {renderLinkWithCount(text, count, () =>
                  handleNavigation(config)
                )}
              </ListItemButton>
            ))}
          </List>
        </Stack>
      }
    />
  )
}

const AllowedRoles = [roles.director]
const DirectorReviewWidgetWithRole = withRole(DirectorReviewCard, AllowedRoles)

export default DirectorReviewWidgetWithRole
