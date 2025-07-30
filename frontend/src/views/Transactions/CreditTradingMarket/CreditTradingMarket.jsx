import React from 'react'
import { Box } from '@mui/material'
import { CreditMarketTable } from './CreditMarketTable'
import { CreditMarketAccordion } from './CreditMarketAccordion'

export const CreditTradingMarket = () => {

  return (
    <Box>
      {/* Market listings table */}
      <Box sx={{ mb: 3 }}>
        <CreditMarketTable />
      </Box>

      {/* Information accordion */}
      <CreditMarketAccordion />
    </Box>
  )
}