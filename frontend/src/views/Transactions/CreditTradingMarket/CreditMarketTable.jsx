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

  // Transform and sort data - show current user's organization at top
  const sortedData = useCallback(() => {
    if (!creditMarketData) return []
    
    const userOrgId = currentUser?.organization?.organizationId
    
    // Transform API data to match frontend schema (no longer exclude current user's org)
    const transformedData = creditMarketData
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

    // Sort with current user's organization at top, then alphabetically
    transformedData.sort((a, b) => {
      // If user has an organization, put it at the top
      if (userOrgId) {
        if (a.id === userOrgId) return -1 // a is user's org, put it first
        if (b.id === userOrgId) return 1  // b is user's org, put it first
      }
      // Otherwise, sort alphabetically
      return a.organizationName.localeCompare(b.organizationName)
    })

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
      <Box 
        component="div" 
        sx={{ 
          height: '100%', 
          width: '100%',
          overflowX: 'auto',
          minWidth: '800px' // Ensure minimum width for proper table display
        }}
      >
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