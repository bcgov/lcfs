import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle
} from 'react'
import { Box } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useCreditMarketListings } from '@/hooks/useOrganization'
import { creditMarketColDefs, defaultSortModel } from './_schema'

const initialPaginationOptions = {
  page: 1,
  size: 10,
  sortOrders: defaultSortModel,
  filters: []
}

export const CreditMarketTable = forwardRef(
  (
    {
      onRowSelect,
      selectedOrgId = null,
      gridRef: externalGridRef
    } = {},
    ref
  ) => {
  const { t } = useTranslation(['common', 'creditMarket'])
  const { data: currentUser } = useCurrentUser()
  const internalGridRef = useRef()
  const gridRef = externalGridRef ?? internalGridRef

  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )

  // Fetch real credit market listings
    const {
      data: creditMarketData,
      isLoading,
      isError,
      refetch: refetchListings,
      error
    } = useCreditMarketListings()

  // Transform and sort data - show current user's organization at top
  const sortedData = useCallback(() => {
    if (!creditMarketData) return []

    const userOrgId = currentUser?.organization?.organizationId

    // Transform API data to match frontend schema (no longer exclude current user's org)
    const transformedData = creditMarketData.map((org) => ({
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
        if (b.id === userOrgId) return 1 // b is user's org, put it first
      }
      // Otherwise, sort alphabetically
      return a.organizationName.localeCompare(b.organizationName)
    })

    return transformedData
  }, [creditMarketData, currentUser?.organization?.organizationId])

  const getRowId = useCallback((params) => {
    return `credit-market-${params.data.id}`
  }, [])

  const selectionGridOptions = useMemo(
    () =>
      onRowSelect
        ? {
            rowSelection: 'single',
            suppressRowClickSelection: false,
            rowMultiSelectWithClick: false
          }
        : undefined,
    [onRowSelect]
  )

  const handleRowClick = useCallback(
    (params) => {
      if (!onRowSelect) return
      const clickedId = params?.data?.id
      if (!clickedId) return

      if (selectedOrgId === clickedId) {
        if (params.api?.deselectAll) {
          params.api.deselectAll()
        }
        onRowSelect(null)
        return
      }

      if (params.api?.deselectAll) {
        params.api.deselectAll()
      }
      if (params.node?.setSelected) {
        params.node.setSelected(true)
      }
      onRowSelect({
        organizationId: clickedId,
        organizationName: params.data.organizationName
      })
    },
    [onRowSelect, selectedOrgId]
  )

  useEffect(() => {
    if (!selectedOrgId && gridRef.current?.api?.deselectAll) {
      gridRef.current.api.deselectAll()
    }
  }, [selectedOrgId])

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

    useImperativeHandle(
      ref,
      () => ({
        refreshListings: () => refetchListings()
      }),
      [refetchListings]
    )

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
            gridOptions={selectionGridOptions}
            columnDefs={creditMarketColDefs(t)}
            getRowId={getRowId}
            overlayNoRowsTemplate={t(
              'creditMarket:noListingsFound',
              'No credit market listings found'
            )}
            queryData={queryData}
            dataKey="creditMarketListings"
            paginationOptions={paginationOptions}
            onPaginationChange={(newPagination) =>
              setPaginationOptions((prev) => ({
                ...prev,
                ...newPagination
              }))
            }
            onRowClicked={onRowSelect ? handleRowClick : undefined}
            // Disable editing since this is view-only
            readOnlyGrid={true}
          />
        </Box>
      </Box>
    )
  }
)

CreditMarketTable.displayName = 'CreditMarketTable'
