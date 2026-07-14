import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { ROUTES } from '@/routes/routes'
import { AppBar, Tab, Tabs } from '@mui/material'
import { PropTypes } from 'prop-types'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { CreditCalculator } from './CreditCalculator'
import { LookupTableView } from '@/views/LookupTable/LookupTableView'

function TabPanel({ children, value, index }) {
  return (
    <BCBox
      role="tabpanel"
      hidden={value !== index}
      id={`calculator-tabpanel-${index}`}
      aria-labelledby={`calculator-tab-${index}`}
    >
      {value === index && children}
    </BCBox>
  )
}

TabPanel.propTypes = {
  children: PropTypes.node,
  value: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired
}

function a11yProps(index) {
  return {
    id: `calculator-tab-${index}`,
    'aria-controls': `calculator-tabpanel-${index}`
  }
}

export function CalculatorMenu({ tabIndex }) {
  const { t } = useTranslation(['common'])
  const navigate = useNavigate()

  const paths = useMemo(
    () => [ROUTES.CREDIT_CALCULATOR, ROUTES.CALCULATION_DATA],
    []
  )

  const tabs = useMemo(
    () => [
      {
        label: 'Compliance unit calculator',
        content: <CreditCalculator />
      },
      {
        label: 'Calculation data',
        content: <LookupTableView />
      }
    ],
    []
  )

  const handleSetTabValue = (event, newValue) => {
    navigate(paths[newValue])
  }

  return (
    <BCBox>
      <BCBox sx={{ mt: 2, bgcolor: 'background.paper' }}>
        <AppBar
          position="static"
          sx={{
            boxShadow: 'none',
            border: 'none',
            backgroundColor: 'transparent'
          }}
        >
          <Tabs
            value={tabIndex}
            onChange={handleSetTabValue}
            aria-label="Calculator tabs"
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: '1px solid #D8D8D8',
              width: 'fit-content',
              maxWidth: { xs: '100%', md: '50%', lg: '40%' },
              '& .MuiTabs-indicator': {
                backgroundColor: '#003366',
                height: '3px'
              },
              '& .MuiTab-root': {
                minWidth: 'auto',
                paddingX: 3,
                whiteSpace: 'nowrap',
                textTransform: 'none',
                fontSize: '15px',
                fontWeight: 600,
                color: '#565656',
                '&.Mui-selected': { color: '#003366', fontWeight: 700 }
              },
              '& .MuiTabs-flexContainer': {
                flexWrap: 'nowrap'
              }
            }}
          >
            {tabs.map((tab, idx) => (
              <Tab key={idx} label={tab.label} {...a11yProps(idx)} />
            ))}
          </Tabs>
        </AppBar>

        {tabIndex === 1 && (
          <BCTypography variant="h5" mb={4} mt={4} color="primary">
            Calculation data
          </BCTypography>
        )}

        <BCBox sx={{ mt: tabIndex === 0 ? 8 : 2 }}>
          {tabs.map((tab, idx) => (
            <TabPanel key={idx} value={tabIndex} index={idx}>
              {tab.content}
            </TabPanel>
          ))}
        </BCBox>
      </BCBox>
    </BCBox>
  )
}

CalculatorMenu.propTypes = {
  tabIndex: PropTypes.number.isRequired
}
