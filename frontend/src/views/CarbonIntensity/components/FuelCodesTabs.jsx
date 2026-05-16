import { AppBar, Tab, Tabs } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config'
import { roles, govRoles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import ROUTES from '@/routes/routes'
import breakpoints from '@/themes/base/breakpoints'

const BULLETINS_PATH = ROUTES.FUEL_CODES.BULLETINS

const isOnBulletins = (loc) => loc.pathname === BULLETINS_PATH
const isArchivedQuery = (loc) =>
  new URLSearchParams(loc.search).get('type') === 'archived'

const buildTabs = ({
  isCiApplicant,
  isSigningAuthority,
  isGovernment,
  ciApplicationsEnabled
}) => {
  const tabs = []
  if (
    ciApplicationsEnabled &&
    (isCiApplicant || isSigningAuthority || isGovernment)
  ) {
    tabs.push({
      key: 'ci',
      labelKey: 'carbonIntensity:tabs.ciApplications',
      path: ROUTES.CI_APPLICATIONS.LIST,
      isActive: (loc) => loc.pathname.startsWith(ROUTES.CI_APPLICATIONS.LIST)
    })
  }
  if (isCiApplicant) {
    tabs.push({
      key: 'mine',
      labelKey: 'carbonIntensity:tabs.myFuelCodes',
      path: ROUTES.FUEL_CODES.MY_LIST,
      isActive: (loc) => loc.pathname === ROUTES.FUEL_CODES.MY_LIST
    })
  }
  tabs.push(
    {
      key: 'current',
      labelKey: 'carbonIntensity:tabs.currentFuelCodes',
      path: BULLETINS_PATH,
      isActive: (loc) => isOnBulletins(loc) && !isArchivedQuery(loc)
    },
    {
      key: 'archived',
      labelKey: 'carbonIntensity:tabs.archivedFuelCodes',
      path: `${BULLETINS_PATH}?type=archived`,
      isActive: (loc) => isOnBulletins(loc) && isArchivedQuery(loc)
    }
  )
  return tabs
}

export const FuelCodesTabs = () => {
  const { t } = useTranslation(['common', 'carbonIntensity'])
  const navigate = useNavigate()
  const location = useLocation()
  const { hasAnyRole } = useCurrentUser()

  const ciApplicationsEnabled = isFeatureEnabled(FEATURE_FLAGS.CI_APPLICATIONS)

  const tabs = useMemo(
    () =>
      buildTabs({
        isCiApplicant: hasAnyRole(roles.ci_applicant),
        isSigningAuthority: hasAnyRole(roles.signing_authority),
        isGovernment: hasAnyRole(...govRoles),
        ciApplicationsEnabled
      }),
    [hasAnyRole, ciApplicationsEnabled]
  )

  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.isActive(location))
  )

  const [tabsOrientation, setTabsOrientation] = useState('horizontal')
  useEffect(() => {
    const handleTabsOrientation = () => {
      setTabsOrientation(
        window.innerWidth < breakpoints.values.lg ? 'vertical' : 'horizontal'
      )
    }
    window.addEventListener('resize', handleTabsOrientation)
    handleTabsOrientation()
    return () => window.removeEventListener('resize', handleTabsOrientation)
  }, [])

  return (
    <AppBar position="static" sx={{ boxShadow: 'none', border: 'none', mb: 3 }}>
      <Tabs
        sx={{
          background: 'rgb(0, 0, 0, 0.08)',
          width: { xs: '100%', md: '60%' }
        }}
        orientation={tabsOrientation}
        value={activeIndex}
        onChange={(_, idx) => navigate(tabs[idx].path)}
        aria-label="Fuel codes navigation tabs"
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.key}
            label={t(tab.labelKey)}
            data-test={`fuel-codes-tab-${tab.key}`}
          />
        ))}
      </Tabs>
    </AppBar>
  )
}

export default FuelCodesTabs
