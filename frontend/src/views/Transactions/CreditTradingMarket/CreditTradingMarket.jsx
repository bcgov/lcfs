import React from 'react'
import { Box } from '@mui/material'
import { CreditMarketTable } from './CreditMarketTable'
import { CreditMarketAccordion } from './CreditMarketAccordion'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'

export const CreditTradingMarket = () => {
  const { t } = useTranslation(['creditMarket'])

  return (
    <Box data-testid="credit-trading-market-view">
      {/* Page heading and disclaimer */}
      <Box mb={3}>
        <BCTypography variant="h4" mb={2} sx={{ color: 'primary.main' }}>
          {t('creditMarket:marketHeading')}
        </BCTypography>

        <BCTypography variant="body2" color="text.secondary" mb={3}>
          {t('creditMarket:marketDisclaimer')}
        </BCTypography>
      </Box>

      {/* Market listings table */}
      <Box sx={{ mb: 3 }}>
        <CreditMarketTable />
      </Box>

      {/* Information accordion */}
      <CreditMarketAccordion />
    </Box>
  )
}
