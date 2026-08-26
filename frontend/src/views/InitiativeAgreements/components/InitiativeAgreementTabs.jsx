import { AppBar, Tab, Tabs } from '@mui/material'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import ROUTES from '@/routes/routes'
import breakpoints from '@/themes/base/breakpoints'

// Tab shell for the Initiative Agreements module (mirrors FuelCodesTabs).
// A Credit Ledger tab was here as a placeholder and has been removed: the
// existing ledger is organization-scoped and no index-level behaviour was
// ever defined for it.
const tabs = [
  {
    key: 'initiativeAgreements',
    labelKey: 'initiativeAgreement:tabs.initiativeAgreements',
    path: ROUTES.INITIATIVE_AGREEMENTS.LIST,
    disabled: false,
    // Prefix match so the tab stays selected on the agreement detail
    // route as well as the index.
    isActive: (loc) =>
      loc.pathname.startsWith(ROUTES.INITIATIVE_AGREEMENTS.LIST)
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
        onChange={(_, idx) => {
          if (tabs[idx].path) {
            navigate(tabs[idx].path)
          }
        }}
        aria-label="Initiative agreements navigation tabs"
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.key}
            label={t(tab.labelKey)}
            disabled={tab.disabled}
            data-test={`initiative-agreements-tab-${tab.key}`}
          />
        ))}
      </Tabs>
    </AppBar>
  )
}

export default InitiativeAgreementTabs
