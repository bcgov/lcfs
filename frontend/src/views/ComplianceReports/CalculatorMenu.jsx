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

function TabPanel({ children, description, value, index }) {
  return (
    <BCBox
      role="tabpanel"
      hidden={value !== index}
      id={`calculator-tabpanel-${index}`}
      aria-labelledby={`calculator-tab-${index}`}
    >
      {value === index && (
        <>
          <BCBox
            data-test="public-calculator-description"
            sx={{
              mb: 3,
              px: { xs: 2, md: 3 },
              py: { xs: 2, md: 2.5 },
              borderLeft: '4px solid',
              borderColor: 'primary.main',
              bgcolor: 'grey.100'
            }}
          >
            {description.map((paragraph, paragraphIndex) => (
              <BCTypography
                key={paragraphIndex}
                component="p"
                variant="body1"
                sx={paragraphIndex > 0 ? { mt: 1 } : undefined}
              >
                {paragraph}
              </BCTypography>
            ))}
          </BCBox>
          {children}
        </>
      )}
    </BCBox>
  )
}

TabPanel.propTypes = {
  children: PropTypes.node,
  description: PropTypes.arrayOf(PropTypes.string).isRequired,
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
        label: t('common:publicDashboard.links.calculator'),
        description: [
          t('common:publicCalculator.calculatorIntro'),
          t('common:publicCalculator.calculatorDisclaimer')
        ],
        content: <CreditCalculator />
      },
      {
        label: t('common:publicDashboard.links.calculationData'),
        description: [
          t('common:publicCalculator.calculationDataIntro'),
          t('common:publicCalculator.calculationDataDisclaimer')
        ],
        content: <LookupTableView />
      }
    ],
    [t]
  )

  const handleSetTabValue = (event, newValue) => {
    navigate(paths[newValue])
  }

  return (
    <BCBox sx={{ bgcolor: 'background.paper', pb: { xs: 4, md: 8 } }}>
      <BCBox
        component="header"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          mb: 3
        }}
      >
        <AppBar position="static" sx={{ boxShadow: 'none', border: 'none' }}>
          <Tabs
            value={tabIndex}
            onChange={handleSetTabValue}
            aria-label={t('common:publicCalculator.tabsAriaLabel')}
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
            {tabs.map((tab, idx) => (
              <Tab key={idx} label={tab.label} {...a11yProps(idx)} />
            ))}
          </Tabs>
        </AppBar>
      </BCBox>

      {tabs.map((tab, idx) => (
        <TabPanel
          key={idx}
          description={tab.description}
          value={tabIndex}
          index={idx}
        >
          {tab.content}
        </TabPanel>
      ))}
    </BCBox>
  )
}

CalculatorMenu.propTypes = {
  tabIndex: PropTypes.number.isRequired
}
