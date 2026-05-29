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
const APPROVED_CI_PATH = ROUTES.APPROVED_CARBON_INTENSITIES
const FUEL_CODES_PATH = ROUTES.FUEL_CODES.LIST
const CI_APPLICATIONS_PATH = ROUTES.CI_APPLICATIONS.LIST

const isOnBulletins = (loc) => loc.pathname === BULLETINS_PATH
const isOnApprovedCI = (loc) => loc.pathname === APPROVED_CI_PATH
const isOnBulletinsOrPublic = (loc) => isOnBulletins(loc) || isOnApprovedCI(loc)
const isOnInternalFuelCodes = (loc) => loc.pathname === FUEL_CODES_PATH
const isOnCIApplications = (loc) =>
  loc.pathname.startsWith(CI_APPLICATIONS_PATH)
const getTypeQuery = (loc) => new URLSearchParams(loc.search).get('type')
const isArchivedQuery = (loc) => getTypeQuery(loc) === 'archived'
const isCurrentQuery = (loc) => getTypeQuery(loc) === 'current'

const ciApplicationsTab = {
  key: 'ci',
  labelKey: 'carbonIntensity:tabs.ciApplications',
  path: CI_APPLICATIONS_PATH,
  isActive: isOnCIApplications
}

const buildInternalFuelCodesTabs = ({ includeCiApplications }) => [
  ...(includeCiApplications ? [ciApplicationsTab] : []),
  {
    key: 'fuelCodes',
    labelKey: 'carbonIntensity:tabs.fuelCodes',
    path: FUEL_CODES_PATH,
    isActive: (loc) =>
      isOnInternalFuelCodes(loc) &&
      !isArchivedQuery(loc) &&
      !isCurrentQuery(loc)
  },
  {
    key: 'current',
    labelKey: 'carbonIntensity:tabs.currentFuelCodes',
    path: `${FUEL_CODES_PATH}?type=current`,
    isActive: (loc) =>
      (isOnInternalFuelCodes(loc) && isCurrentQuery(loc)) ||
      (isOnBulletins(loc) && !isArchivedQuery(loc))
  },
  {
    key: 'archived',
    labelKey: 'carbonIntensity:tabs.archivedFuelCodes',
    path: `${FUEL_CODES_PATH}?type=archived`,
    isActive: (loc) =>
      (isOnInternalFuelCodes(loc) || isOnBulletins(loc)) && isArchivedQuery(loc)
  }
]

const buildTabs = ({
  isCiApplicant,
  isSigningAuthority,
  isGovernment,
  ciApplicationsEnabled,
  variant,
  location
}) => {
  const canAccessCiApplications =
    ciApplicationsEnabled &&
    (isCiApplicant || isSigningAuthority || isGovernment)

  if (isGovernment && isOnBulletins(location)) {
    return buildInternalFuelCodesTabs({
      includeCiApplications: ciApplicationsEnabled
    })
  }

  if (
    variant === 'internal' ||
    (isGovernment &&
      (isOnInternalFuelCodes(location) || isOnCIApplications(location)))
  ) {
    return buildInternalFuelCodesTabs({
      includeCiApplications: ciApplicationsEnabled
    })
  }

  const tabs = []
  if (canAccessCiApplications) {
    tabs.push(ciApplicationsTab)
  }
  if (isCiApplicant) {
    tabs.push({
      key: 'mine',
      labelKey: 'carbonIntensity:tabs.myFuelCodes',
      path: FUEL_CODES_PATH,
      isActive: isOnInternalFuelCodes
    })
  } else if (isGovernment) {
    tabs.push({
      key: 'manage',
      labelKey: 'carbonIntensity:tabs.fuelCodes',
      path: ROUTES.FUEL_CODES.LIST,
      isActive: (loc) => loc.pathname === ROUTES.FUEL_CODES.LIST
    })
  }

  if (!isGovernment) {
    const basePath = isOnApprovedCI(location)
      ? APPROVED_CI_PATH
      : BULLETINS_PATH
    tabs.push(
      {
        key: 'current',
        labelKey: 'carbonIntensity:tabs.currentFuelCodes',
        path: basePath,
        isActive: (loc) => isOnBulletinsOrPublic(loc) && !isArchivedQuery(loc)
      },
      {
        key: 'archived',
        labelKey: 'carbonIntensity:tabs.archivedFuelCodes',
        path: `${basePath}?type=archived`,
        isActive: (loc) => isOnBulletinsOrPublic(loc) && isArchivedQuery(loc)
      }
    )
  }
  return tabs
}

export const FuelCodesTabs = ({ variant = 'default' } = {}) => {
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
        ciApplicationsEnabled,
        variant,
        location
      }),
    [hasAnyRole, ciApplicationsEnabled, variant, location]
  )

  const matchedIndex = tabs.findIndex((tab) => tab.isActive(location))
  const activeIndex = matchedIndex === -1 ? false : matchedIndex

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
