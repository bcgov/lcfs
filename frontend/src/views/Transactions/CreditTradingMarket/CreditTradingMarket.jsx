import React, { useState, useCallback, useRef } from 'react'
import { Box, Stack } from '@mui/material'
import { CreditMarketTable } from './CreditMarketTable'
import { CreditMarketAccordion } from './CreditMarketAccordion'
import { CreditMarketDetailsCard } from './CreditMarketDetailsCard'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { govRoles } from '@/constants/roles'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import BCButton from '@/components/BCButton'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes } from '@fortawesome/free-solid-svg-icons'

export const CreditTradingMarket = () => {
  const { t } = useTranslation(['creditMarket'])
  const { hasAnyRole } = useCurrentUser()
  const isGovernmentUser = hasAnyRole(...govRoles)
  const [selectedListing, setSelectedListing] = useState(null)
  const gridRef = useRef(null)
  const tableRef = useRef(null)

  const handleRowSelect = useCallback((row) => {
    setSelectedListing(row)
  }, [])

  const handleClearSelection = useCallback(() => {
    gridRef.current?.api?.deselectAll?.()
    setSelectedListing(null)
  }, [])

  const handleRefreshListings = useCallback(() => {
    tableRef.current?.refreshListings?.()
  }, [])

  const handleClearFilters = useCallback(() => {
    gridRef.current?.clearFilters?.()
    gridRef.current?.api?.setSortModel?.([])
    setSelectedListing(null)
    handleRefreshListings()
  }, [handleRefreshListings])

  return (
    <Box data-testid="credit-trading-market-view">
      {/* Page heading and disclaimer */}
      <Box mb={3} mt={-2}>

        <BCTypography variant="body2" color="text.secondary" mb={3}>
          {t('creditMarket:marketDisclaimer')}
        </BCTypography>
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        mb={3}
        flexWrap="wrap"
      >
        <ClearFiltersButton
          onClick={handleClearFilters}
          sx={{ minWidth: 'fit-content', whiteSpace: 'nowrap' }}
        />
        {isGovernmentUser && (
          <BCButton
            variant="outlined"
            size="small"
            color="primary"
            onClick={handleClearSelection}
            startIcon={<FontAwesomeIcon icon={faTimes} />}
            disabled={!selectedListing}
          >
            {t('creditMarket:clearSelection', 'Clear selection')}
          </BCButton>
        )}
      </Stack>

      {isGovernmentUser && selectedListing && (
        <Box sx={{ mb: 3 }}>
          <CreditMarketDetailsCard
            key={selectedListing.organizationId}
            organizationId={selectedListing.organizationId}
            variant="admin"
            onSaveSuccess={handleRefreshListings}
          />
        </Box>
      )}

      {/* Market listings table */}
      <Box sx={{ mb: 3 }}>
        <CreditMarketTable
          ref={tableRef}
          gridRef={gridRef}
          onRowSelect={isGovernmentUser ? handleRowSelect : undefined}
          selectedOrgId={selectedListing?.organizationId ?? null}
        />
      </Box>

      {/* Information accordion */}
      <CreditMarketAccordion />
    </Box>
  )
}
