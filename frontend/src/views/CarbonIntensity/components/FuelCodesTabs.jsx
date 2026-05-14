import { Box, Tab, Tabs } from '@mui/material'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { roles, govRoles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import ROUTES from '@/routes/routes'

const BULLETINS_PATH = ROUTES.FUEL_CODES.BULLETINS

const isOnBulletins = (loc) => loc.pathname === BULLETINS_PATH
const isArchivedQuery = (loc) =>
  new URLSearchParams(loc.search).get('type') === 'archived'

const buildTabs = ({ isCiApplicant, isSigningAuthority, isGovernment }) => {
  const tabs = []
  if (isCiApplicant || isSigningAuthority || isGovernment) {
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
      path: ROUTES.FUEL_CODES.LIST,
      isActive: (loc) => loc.pathname === ROUTES.FUEL_CODES.LIST
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
  }
  return tabs
}

export const FuelCodesTabs = () => {
  const { t } = useTranslation(['common', 'carbonIntensity'])
  const navigate = useNavigate()
  const location = useLocation()
  const { hasAnyRole } = useCurrentUser()

  const tabs = useMemo(
    () =>
      buildTabs({
        isCiApplicant: hasAnyRole(roles.ci_applicant),
        isSigningAuthority: hasAnyRole(roles.signing_authority),
        isGovernment: hasAnyRole(...govRoles)
      }),
    [hasAnyRole]
  )

  const matchedIndex = tabs.findIndex((tab) => tab.isActive(location))
  const activeIndex = matchedIndex === -1 ? false : matchedIndex

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
      <Tabs
        value={activeIndex}
        onChange={(_, idx) => navigate(tabs[idx].path)}
        aria-label="Fuel codes navigation tabs"
        variant="scrollable"
        scrollButtons="auto"
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.key}
            label={t(tab.labelKey)}
            data-test={`fuel-codes-tab-${tab.key}`}
          />
        ))}
      </Tabs>
    </Box>
  )
}

export default FuelCodesTabs
