import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { AppBar, Tab, Tabs } from '@mui/material'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

interface BulletinMenuBarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export const BulletinMenuBar = ({
  activeTab,
  onTabChange
}: BulletinMenuBarProps) => {
  const { t } = useTranslation(['bulletins'])
  const { hasRoles } = useCurrentUser()
  const isCiApplicant = hasRoles(roles.ci_applicant)

  const tabs = useMemo(() => {
    const allTabs = []
    if (isCiApplicant) {
      allTabs.push({ value: 'my', label: t('tabs.myFuelCodes') })
    }
    allTabs.push(
      { value: 'current', label: t('tabs.current') },
      { value: 'archived', label: t('tabs.archived') }
    )
    return allTabs
  }, [t, isCiApplicant])

  const tabIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.value === activeTab)
  )

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    onTabChange(tabs[newValue].value)
  }

  return (
    <AppBar position="static" sx={{ boxShadow: 'none', border: 'none' }}>
      <Tabs
        sx={{
          background: 'rgb(0, 0, 0, 0.08)',
          width: { xs: '100%', md: '40%' }
        }}
        value={tabIndex}
        onChange={handleChange}
        aria-label="Fuel code bulletin type"
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.value}
            label={tab.label}
            data-test={`fuel-codes-tab-${tab.value}`}
          />
        ))}
      </Tabs>
    </AppBar>
  )
}
