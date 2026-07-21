import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'
import BCTypography from '@/components/BCTypography'
import { OrganizationDetailsCard } from './OrganizationDetailsCard'
import { OrganizationUsers } from './OrganizationUsers'
import { CreditLedger } from './CreditLedger'
import CompanyOverview from './components/CompanyOverview'
import { PenaltyLog } from './components/PenaltyLog/PenaltyLog'
import PenaltyLogManage from './components/PenaltyLog/PenaltyLogManage'
import SupplyHistory from './components/SupplyHistory'
import ComplianceTracking from './components/ComplianceTracking'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/routes/routes'
import colors from '@/themes/base/colors'
import borders from '@/themes/base/borders'
import boxShadows from '@/themes/base/boxShadows'
import {
  orgDashboardRenderers,
  orgDashboardRoutes
} from '@/routes/routeConfig/organizationRoutes'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrganizationPageStore } from '@/stores/useOrganizationPageStore'

function TabPanel({ children, value, index }) {
  return (
    <BCBox
      role="tabpanel"
      hidden={value !== index}
      id={`organization-tabpanel-${index}`}
      aria-labelledby={`organization-tab-${index}`}
    >
      {value === index && children}
    </BCBox>
  )
}

export const OrganizationView = ({ addMode = false }) => {
  const location = useLocation()
  const navigate = useNavigate()
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
        {/* Section navigation. A wrapping flex row (not MUI <Tabs>, which is a
            single scrollable row) so every section stays visible at any width —
            tabs fold onto additional rows instead of being clipped. */}
        <BCBox
          role="tablist"
          aria-label="Organization tabs"
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            p: '4px',
            // Shrink to the tabs' width (compact pill, matching the original
            // look) but wrap onto more rows once they exceed the available
            // width instead of clipping.
            width: 'fit-content',
            maxWidth: '100%',
            boxSizing: 'border-box',
            background: 'rgba(0, 0, 0, 0.08)',
            borderRadius: borders.borderRadius.xl
          }}
        >
          {tabConfig.map((config, idx) => {
            const selected = idx === tabIndex
            return (
              <BCBox
                key={config.path}
                component="button"
                type="button"
                role="tab"
                id={`organization-tab-${idx}`}
                aria-selected={selected}
                aria-controls={`organization-tabpanel-${idx}`}
                onClick={() => handleTabChange(null, idx)}
                sx={{
                  border: 'none',
                  cursor: 'pointer',
                  font: 'inherit',
                  fontSize: '0.875rem',
                  fontWeight: selected ? 700 : 500,
                  whiteSpace: 'nowrap',
                  px: 2,
                  py: 1,
                  borderRadius: borders.borderRadius.lg,
                  color: colors.text.primary,
                  backgroundColor: selected ? colors.white.main : 'transparent',
                  boxShadow: selected
                    ? boxShadows.tabsBoxShadow.indicator
                    : 'none',
                  transition:
                    'background-color 200ms ease, box-shadow 200ms ease',
                  '&:hover': {
                    backgroundColor: selected
                      ? colors.white.main
                      : 'rgba(0, 0, 0, 0.06)'
                  },
                  '&:focus-visible': {
                    outline: `2px solid ${colors.primary.main}`,
                    outlineOffset: '2px'
                  }
                }}
              >
                {config.label}
              </BCBox>
            )
          })}
        </BCBox>
        {organizationTitle && (
          <BCTypography variant="h5" color="primary" mt={3}>
            {organizationTitle}
          </BCTypography>
        )}
        <BCBox sx={{ pt: 3 }}>{renderContent()}</BCBox>
      </BCBox>
    </BCBox>
  )
}
