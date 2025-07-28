import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Stack, List, ListItemButton } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import withRole from '@/utils/withRole'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/routes/routes'
import { useDirectorReviewCounts } from '@/hooks/useDashboard'
import { FILTER_KEYS } from '@/constants/common'
import {
  COMPLIANCE_REPORT_STATUSES,
  TRANSACTION_STATUSES,
  TRANSFER_STATUSES,
  FUEL_CODE_STATUSES
} from '@/constants/statuses'

// Constants for filter configurations
const FILTER_CONFIGS = {
  transfers: {
    route: ROUTES.TRANSACTIONS.LIST,
    gridKey: FILTER_KEYS.TRANSACTIONS_GRID,
    filter: JSON.stringify({
      transactionType: {
        filterType: 'text',
        type: 'equals',
        filter: 'Transfer'
      },
      status: {
        filterType: 'text',
        type: 'equals',
        filter: TRANSFER_STATUSES.RECOMMENDED
      }
    })
  },
  complianceReports: {
    route: ROUTES.REPORTS.LIST,
    gridKey: FILTER_KEYS.COMPLIANCE_REPORT_GRID,
    filter: JSON.stringify({
      status: {
        filterType: 'text',
        type: 'equals',
        filter: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      }
    })
  },
  initiativeAgreements: {
    route: ROUTES.TRANSACTIONS.LIST,
    gridKey: FILTER_KEYS.TRANSACTIONS_GRID,
    filter: JSON.stringify({
      transactionType: {
        filterType: 'text',
        type: 'equals',
        filter: 'Initiative Agreement'
      },
      status: {
        filterType: 'text',
        type: 'equals',
        filter: TRANSACTION_STATUSES.RECOMMENDED
      }
    })
  },
  adminAdjustments: {
    route: ROUTES.TRANSACTIONS.LIST,
    gridKey: FILTER_KEYS.TRANSACTIONS_GRID,
    filter: JSON.stringify({
      transactionType: {
        filterType: 'text',
        type: 'equals',
        filter: 'Admin Adjustment'
      },
      status: {
        filterType: 'text',
        type: 'equals',
        filter: TRANSACTION_STATUSES.RECOMMENDED
      }
    })
  },
  fuelCodes: {
    route: ROUTES.FUEL_CODES.LIST,
    gridKey: FILTER_KEYS.FUEL_CODES_GRID,
    filter: JSON.stringify({
      status: {
        filterType: 'text',
        type: 'equals',
        filter: FUEL_CODE_STATUSES.RECOMMENDED
      }
    })
  }
}

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
      sessionStorage.setItem(config.gridKey, config.filter)
      navigate(config.route)
    },
    [navigate]
  )

  const renderLinkWithCount = useCallback(
    (text, count, onClick) => (
      <>
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
      },
      {
        key: 'fuelCodes',
        text: t('dashboard:directorReview.fuelCodesForReview'),
        count: counts.fuelCodes || 0,
        config: FILTER_CONFIGS.fuelCodes
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
