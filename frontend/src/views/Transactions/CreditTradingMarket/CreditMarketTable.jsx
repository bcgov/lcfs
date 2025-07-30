import React, { useState, useRef, useCallback } from 'react'
import { Box } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useCreditMarketListings } from '@/hooks/useOrganization'
import { 
  creditMarketColDefs, 
  defaultSortModel 
} from './_schema'

const initialPaginationOptions = {
  page: 1,
  size: 10,
  sortOrders: defaultSortModel,
  filters: []
}

export const CreditMarketTable = () => {
  const { t } = useTranslation(['common', 'creditMarket'])
  const { data: currentUser } = useCurrentUser()
  const gridRef = useRef()

  const [paginationOptions, setPaginationOptions] = useState(initialPaginationOptions)

  // Fetch real credit market listings
  const { data: creditMarketData, isLoading, isError, error } = useCreditMarketListings()

  // Transform and sort data - exclude current user's organization
  const sortedData = useCallback(() => {
    if (!creditMarketData) return []
    
    const userOrgId = currentUser?.organization?.organizationId
    
    // Transform API data to match frontend schema and exclude current user's org
    const transformedData = creditMarketData
      .filter(org => org.organizationId !== userOrgId) // Exclude current user's organization
      .map(org => ({
        id: org.organizationId,
        organizationName: org.organizationName,
        creditsToSell: org.creditsToSell,
        displayInCreditMarket: org.displayInCreditMarket,
        isSeller: org.creditMarketIsSeller,
        isBuyer: org.creditMarketIsBuyer,
        contactPerson: org.creditMarketContactName,
        email: org.creditMarketContactEmail,
        phone: org.creditMarketContactPhone
      }))

    // Sort alphabetically
    transformedData.sort((a, b) => a.organizationName.localeCompare(b.organizationName))

    return transformedData
  }, [creditMarketData, currentUser?.organization?.organizationId])

  const getRowId = useCallback((params) => {
    return `credit-market-${params.data.id}`
  }, [])

  // Build query data structure for BCGridViewer
  const queryData = {
    data: {
      creditMarketListings: sortedData(),
      pagination: {
        page: paginationOptions.page,
        size: paginationOptions.size,
        total: sortedData().length,
        totalPages: Math.ceil(sortedData().length / paginationOptions.size)
      }
    },
    isLoading,
    isError,
    error
  }

  return (
    <Box>
      <Box component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridRef={gridRef}
          gridKey="credit-market-grid"
          columnDefs={creditMarketColDefs(t)}
          getRowId={getRowId}
          overlayNoRowsTemplate={t('creditMarket:noListingsFound', 'No credit market listings found')}
          queryData={queryData}
          dataKey="creditMarketListings"
          paginationOptions={paginationOptions}
          onPaginationChange={(newPagination) =>
            setPaginationOptions((prev) => ({
              ...prev,
              ...newPagination
            }))
          }
          // Disable editing since this is view-only
          readOnlyGrid={true}
        />
      </Box>
    </Box>
  )
}