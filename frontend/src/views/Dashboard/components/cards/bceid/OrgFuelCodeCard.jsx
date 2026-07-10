import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Stack, List, ListItemButton } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import withRole from '@/utils/withRole'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/routes/routes'
import { useOrgFuelCodeCounts } from '@/hooks/useDashboard'

// When `hidden`, the number is rendered invisibly but still occupies layout,
// so plain links (with no count) share the same indent and row height as the
// counted links above them.
const CountDisplay = ({ count, hidden = false }) => (
  <BCTypography
    component="span"
    variant="h3"
    aria-hidden={hidden || undefined}
    sx={{
      color: 'success.main',
      marginX: 3,
      ...(hidden && { visibility: 'hidden' })
    }}
  >
    {count}
  </BCTypography>
)

const linkSx = {
  textDecoration: 'underline',
  '&:hover': { color: 'info.main' }
}

const OrgFuelCodeCard = () => {
  const { t } = useTranslation(['dashboard'])
  const navigate = useNavigate()
  const { data: counts, isLoading } = useOrgFuelCodeCounts()

  // CI applicants create carbon intensity applications that become fuel codes
  // once approved by government, so this "Fuel codes" card surfaces the org's
  // in-draft and submitted-for-review CI applications.
  const draftCount = counts?.draft || 0
  const submittedCount = counts?.submitted || 0
  const hasApplications = draftCount > 0 || submittedCount > 0

  const renderLinkWithCount = (text, count, onClick) => {
    return count > 0 ? (
      <ListItemButton component="a" onClick={onClick}>
        <CountDisplay count={count} />
        <BCTypography
          variant="body2"
          color="link"
          sx={linkSx}
          onClick={onClick}
        >
          {text}
        </BCTypography>
      </ListItemButton>
    ) : null
  }

  const renderPlainLink = (text, onClick) => (
    <ListItemButton component="a" onClick={onClick}>
      <CountDisplay count={0} hidden />
      <BCTypography variant="body2" color="link" sx={linkSx} onClick={onClick}>
        {text}
      </BCTypography>
    </ListItemButton>
  )

  const goToList = () => navigate(ROUTES.CI_APPLICATIONS.LIST)
  const goToNew = () => navigate(ROUTES.CI_APPLICATIONS.ADD)

  return (
    <BCWidgetCard
      component="div"
      title={t('dashboard:orgFuelCodes.title')}
      sx={{ '& .MuiCardContent-root': { padding: '16px' } }}
      content={
        isLoading ? (
          <Loading message={t('dashboard:orgFuelCodes.loadingMessage')} />
        ) : (
          <Stack spacing={1}>
            {hasApplications ? (
              <BCTypography variant="body2" sx={{ marginBottom: 0 }}>
                {t('dashboard:orgFuelCodes.thereAre')}
              </BCTypography>
            ) : (
              <BCTypography variant="body2" style={{ marginTop: '10px' }}>
                {t('dashboard:orgFuelCodes.noApplications')}
              </BCTypography>
            )}
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
                t('dashboard:orgFuelCodes.inDraft'),
                draftCount,
                goToList
              )}
              {renderLinkWithCount(
                t('dashboard:orgFuelCodes.submittedForReview'),
                submittedCount,
                goToList
              )}
              {renderPlainLink(t('dashboard:orgFuelCodes.viewAll'), goToList)}
              {renderPlainLink(t('dashboard:orgFuelCodes.startNew'), goToNew)}
            </List>
          </Stack>
        )
      }
    />
  )
}

const AllowedRoles = [roles.ci_applicant]
const OrgFuelCodeCardWithRole = withRole(OrgFuelCodeCard, AllowedRoles)

export default OrgFuelCodeCardWithRole
