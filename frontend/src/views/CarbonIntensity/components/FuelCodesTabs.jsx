import { Box, Tab, Tabs } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import ROUTES from '@/routes/routes'

const TAB_DEFS = [
  { key: 'ci', labelKey: 'carbonIntensity:tabs.ciApplications', path: ROUTES.CI_APPLICATIONS.LIST },
  { key: 'mine', labelKey: 'carbonIntensity:tabs.myFuelCodes', path: ROUTES.FUEL_CODES.LIST },
  { key: 'current', labelKey: 'carbonIntensity:tabs.currentFuelCodes', path: ROUTES.FUEL_CODES.BULLETINS },
  { key: 'archived', labelKey: 'carbonIntensity:tabs.archivedFuelCodes', path: `${ROUTES.FUEL_CODES.BULLETINS}?type=archived` }
]

export const FuelCodesTabs = () => {
  const { t } = useTranslation(['common', 'carbonIntensity'])
  const navigate = useNavigate()
  const location = useLocation()

  const activeIndex = (() => {
    const idx = TAB_DEFS.findIndex((tab) =>
      location.pathname.startsWith(tab.path.split('?')[0])
    )
    return idx === -1 ? 0 : idx
  })()

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
      <Tabs
        value={activeIndex}
        onChange={(_, idx) => navigate(TAB_DEFS[idx].path)}
        aria-label="Fuel codes navigation tabs"
        variant="scrollable"
        scrollButtons="auto"
      >
        {TAB_DEFS.map((tab) => (
          <Tab key={tab.key} label={t(tab.labelKey)} />
        ))}
      </Tabs>
    </Box>
  )
}

export default FuelCodesTabs
