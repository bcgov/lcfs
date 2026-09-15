import { AppBar, Tab, Tabs } from '@mui/material'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import ROUTES from '@/routes/routes'
import breakpoints from '@/themes/base/breakpoints'

// Tab shell for the Initiative Agreements module (mirrors FuelCodesTabs).
// Two tabs: the agreements themselves, and every designated action across
// them (#5078). A Credit Ledger tab appears in the wireframe but was
// removed by an earlier product decision — the ledger is organization-
// scoped and no index-level behaviour was ever defined for it.
const AGREEMENTS = ROUTES.INITIATIVE_AGREEMENTS.LIST
const ACTIONS = ROUTES.INITIATIVE_AGREEMENTS.ACTIONS_LIST

const isOnActionsTab = (loc) =>
  loc.pathname === ACTIONS ||
  // The action's own page belongs with the actions tab, wherever it was
  // reached from.
  /\/designated-actions\/\d+/.test(loc.pathname)

const tabs = [
  {
    key: 'initiativeAgreements',
    labelKey: 'initiativeAgreement:tabs.initiativeAgreements',
    path: AGREEMENTS,
    isActive: (loc) =>
      loc.pathname.startsWith(AGREEMENTS) && !isOnActionsTab(loc)
  },
  {
    key: 'designatedActions',
    labelKey: 'initiativeAgreement:tabs.designatedActions',
    path: ACTIONS,
    isActive: isOnActionsTab
  }
]

export const InitiativeAgreementTabs = () => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const navigate = useNavigate()
  const location = useLocation()

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
          width: { xs: '100%', md: '40%' }
        }}
        orientation={tabsOrientation}
        value={activeIndex}
        onChange={(_, idx) => navigate(tabs[idx].path)}
        aria-label={t('initiativeAgreement:tabs.ariaLabel')}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.key}
            label={t(tab.labelKey)}
            data-test={`initiative-agreements-tab-${tab.key}`}
          />
        ))}
      </Tabs>
    </AppBar>
  )
}

export default InitiativeAgreementTabs
