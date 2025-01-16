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
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgComplianceReportCounts } from '@/hooks/useDashboard'

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

const OrgComplianceReportsCard = () => {
  const { t } = useTranslation(['dashboard'])
  const navigate = useNavigate()
  const { data: orgData, isLoading: orgLoading } = useOrganization()
  const { data: counts, isLoading } = useOrgComplianceReportCounts()

  const handleNavigation = (route, status) => {
    const filters = [
      { field: 'status', filterType: 'text', type: 'equals', filter: status }
    ]
    navigate(route, { state: { filters } })
  }

  const renderLinkWithCount = (text, count, onClick) => {
    return count > 0 ? (
      <ListItemButton component="a" onClick={onClick}>
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
      </ListItemButton>
    ) : null
  }

  const inProgressCount = counts?.inProgress || 0
  const awaitingGovReviewCount = counts?.awaitingGovReview || 0

  return (
    <BCWidgetCard
      component="div"
      title={t('dashboard:orgComplianceReports.title')}
      sx={{ '& .MuiCardContent-root': { padding: '16px' } }}
      content={
        isLoading ? (
          <Loading
            message={t('dashboard:orgComplianceReports.loadingMessage')}
          />
        ) : (
          <Stack spacing={1}>
            {inProgressCount === 0 && awaitingGovReviewCount === 0 ? (
              <BCTypography variant="body2" style={{ marginTop: '10px' }}>
                {t('dashboard:orgComplianceReports.noActionRequired')}
              </BCTypography>
            ) : (
              <>
                <BCTypography variant="body2" sx={{ marginBottom: 0 }}>
                  {t('dashboard:orgComplianceReports.orgHas', {
                    name: orgData?.name
                  })}
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
                  {renderLinkWithCount(
                    t('dashboard:orgComplianceReports.inProgress'),
                    inProgressCount,
                    () => handleNavigation(ROUTES.REPORTS, 'Draft')
                  )}
                  {renderLinkWithCount(
                    t('dashboard:orgComplianceReports.awaitingGovReview'),
                    awaitingGovReviewCount,
                    () => handleNavigation(ROUTES.REPORTS, 'Submitted')
                  )}
                </List>
              </>
            )}
          </Stack>
        )
      }
    />
  )
}

const AllowedRoles = [roles.compliance_reporting, roles.signing_authority]
const OrgComplianceReportsWidgetWithRole = withRole(
  OrgComplianceReportsCard,
  AllowedRoles
)

export default OrgComplianceReportsWidgetWithRole
