import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'
import BCTypography from '@/components/BCTypography'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'
import {
  orgDashboardRenderers,
  orgDashboardRoutes
} from '@/routes/routeConfig/organizationRoutes'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrganizationPageStore } from '@/stores/useOrganizationPageStore'
import { AppBar, Tab, Tabs } from '@mui/material'
import { useTranslation } from 'react-i18next'
import OrganizationList from '@/views/Transactions/components/OrganizationList'

function a11yProps(index) {
  return {
    id: `organization-tab-${index}`,
    'aria-controls': `organization-tabpanel-${index}`
  }
}

export const OrganizationView = ({ addMode = false }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation(['org'])
  const { orgID } = useParams()
  const [alert, setAlert] = useState(null)

  const { data: currentUser, hasRoles } = useCurrentUser()
  const setOrganizationContext = useOrganizationPageStore(
    (state) => state.setOrganizationContext
  )
  const resetOrganizationContext = useOrganizationPageStore(
    (state) => state.resetOrganizationContext
  )

  // Get the organization ID - either from URL params (IDIR users) or from current user (BCeID users)
  const organizationId = orgID ?? currentUser?.organization?.organizationId

  // Check if user is government (IDIR) - only they should see all tabs
  const isGovernment = hasRoles(roles.government)
  const showOrganizationHeader = isGovernment && !addMode

  const { data: organizationData } = useOrganization(organizationId, {
    enabled: showOrganizationHeader && !!organizationId
  })

  useEffect(() => {
    if (location.state?.message) {
      setAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location, navigate])

  const tabConfig = useMemo(() => {
    return orgDashboardRoutes(organizationId, isGovernment)
  }, [isGovernment, organizationId])

  // Determine current tab index based on location
  const tabIndex = useMemo(() => {
    const currentPath = location.pathname

    // Direct access to manage route should highlight penalty log tab
    if (currentPath.includes('/penalty-log/manage')) {
      const penaltyIndex = tabConfig.findIndex((config) =>
        config.path.includes('/penalty-log')
      )
      return penaltyIndex >= 0 ? penaltyIndex : 0
    }

    const matchIndex = tabConfig.findIndex((config) => {
      if (config.match) {
        return config.match(currentPath)
      }
      return currentPath === config.path
    })
    return matchIndex >= 0 ? matchIndex : 0
  }, [location.pathname, tabConfig])

  const handleTabChange = (event, newValue) => {
    const targetPath = tabConfig[newValue]?.path
    if (targetPath) {
      navigate(targetPath)
    }
  }

  const handleOrganizationChange = useCallback(
    ({ id }) => {
      if (!id) {
        return
      }

      const currentPath = location.pathname || ''
      const nextPath =
        organizationId && currentPath.includes(`/organizations/${organizationId}`)
          ? currentPath.replace(
              `/organizations/${organizationId}`,
              `/organizations/${id}`
            )
          : orgDashboardRoutes(String(id), true)[0]?.path

      navigate(nextPath)
    },
    [location.pathname, navigate, organizationId]
  )

  // Render content based on current route
  const renderContent = useCallback(() => {
    const currentPath = location.pathname || ''
    return orgDashboardRenderers(
      isGovernment,
      currentPath,
      organizationId,
      addMode,
      navigate
    )
  }, [isGovernment, organizationId, location, addMode, navigate])

  const currentTab = tabConfig[tabIndex] || null
  const currentTabLabel = currentTab?.label || null

  const organizationTitle =
    showOrganizationHeader && organizationData?.name
      ? `${organizationData.name}${
          currentTabLabel ? ` — ${currentTabLabel}` : ''
        }`
      : currentTabLabel

  useEffect(() => {
    if (!showOrganizationHeader) {
      resetOrganizationContext()
      return
    }

    if (!organizationData?.name) {
      resetOrganizationContext()
      return
    }

    setOrganizationContext({
      organizationName: organizationData.name,
      activeTabLabel: currentTabLabel
    })

    return () => {
      resetOrganizationContext()
    }
  }, [
    showOrganizationHeader,
    organizationData?.name,
    currentTabLabel,
    setOrganizationContext,
    resetOrganizationContext
  ])

  return (
    <BCBox>
      {alert && (
        <BCAlert severity={alert.severity} sx={{ mb: 4 }}>
          {alert.message}
        </BCAlert>
      )}

      <BCBox sx={{ mt: 0, bgcolor: 'background.paper' }}>
        <AppBar position="static" sx={{ boxShadow: 'none', border: 'none' }}>
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            aria-label="Organization tabs"
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              backgroundColor: 'rgba(0, 0, 0, 0.08)',
              width: 'fit-content',
              maxWidth: '100%',
              '& .MuiTab-root': {
                minWidth: 'auto',
                minHeight: 36,
                paddingX: 2,
                paddingY: 0.75,
                marginX: 0.25,
                whiteSpace: 'nowrap'
              },
              '& .MuiTabs-flexContainer': {
                flexWrap: 'nowrap'
              }
            }}
          >
            {tabConfig.map((config, idx) => (
              <Tab key={config.path} label={config.label} {...a11yProps(idx)} />
            ))}
          </Tabs>
        </AppBar>
        {(organizationTitle || showOrganizationHeader) && (
          <BCBox
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'flex-start', md: 'center' },
              justifyContent: 'space-between',
              gap: 2,
              mt: 3
            }}
          >
            {organizationTitle && (
              <BCTypography variant="h5" color="primary">
                {organizationTitle}
              </BCTypography>
            )}
            {showOrganizationHeader && (
              <OrganizationList
                selectedOrg={{ id: organizationId }}
                onOrgChange={handleOrganizationChange}
                onlyRegistered={false}
                includeAllOption={false}
                label={t('org:supplyHistory.showOrganization')}
                placeholder={t('org:supplyHistory.selectOrganization')}
                showSelectedLabel={false}
              />
            )}
          </BCBox>
        )}
        <BCBox sx={{ pt: 3 }}>{renderContent()}</BCBox>
      </BCBox>
    </BCBox>
  )
}
