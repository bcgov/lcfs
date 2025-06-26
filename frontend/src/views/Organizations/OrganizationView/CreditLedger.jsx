import React, { useState, useRef, useCallback } from 'react'
import { Grid, FormControl, Select, MenuItem } from '@mui/material'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { DownloadButton } from '@/components/DownloadButton'

import {
  useCreditLedger,
  useDownloadCreditLedger
} from '@/hooks/useCreditLedger'
import { useOrganizationBalance } from '@/hooks/useOrganization'
import { useCompliancePeriod } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTranslation } from 'react-i18next'
import { timezoneFormatter } from '@/utils/formatters'

export const CreditLedger = ({ organizationId }) => {
  const { t } = useTranslation(['org', 'common'])
  const gridRef = useRef(null)

  const { data: currentUser } = useCurrentUser()
  // Use passed organizationId prop, fallback to current user's org for backward compatibility
  const orgID = organizationId ?? currentUser?.organization?.organizationId

  const [pagination, setPagination] = useState({ page: 1, size: 10 })
  const [selectedPeriod, setSelectedPeriod] = useState('')

  const { data: periodsRes, isLoading: periodsLoading } = useCompliancePeriod()

  // The compliance periods endpoint returns the data directly, not wrapped in a data object
  const allPeriods = periodsRes ?? []
  const currentYear = new Date().getFullYear()

  // Show compliance periods from 2018 onwards up to the current year
  // The credit ledger will naturally only show data for years with transactions
  const compliancePeriods = allPeriods
    .filter(
      (p) =>
        Number(p.description) >= 2018 && Number(p.description) <= currentYear
    )
    .sort((a, b) => Number(b.description) - Number(a.description))

  const { data: ledgerRes, isLoading: ledgerLoading } = useCreditLedger({
    orgId: orgID,
    page: pagination.page,
    size: pagination.size,
    period: selectedPeriod
  })

  // Get full ledger data (without period filter) to calculate year-specific balances
  const { data: fullLedgerRes } = useCreditLedger({
    orgId: orgID,
    page: 1,
    size: 1000, // Large size to get all transactions
    period: '' // No period filter
  })

  const { data: orgBalance } = useOrganizationBalance(orgID)

  // Function to get available balance for a specific year or current balance for "All years"
  const getAvailableBalanceForPeriod = () => {
    if (!selectedPeriod) {
      // "All years" - show current total balance
      return orgBalance?.totalBalance ?? 0
    }

    if (!fullLedgerRes?.ledger) {
      return 0
    }

    const selectedYear = Number(selectedPeriod)
    
    // Get all transactions up to and including the selected year
    const transactionsUpToYear = fullLedgerRes.ledger.filter(
      (tx) => Number(tx.compliancePeriod) <= selectedYear
    )
    
    // Get all negative transactions after the selected year
    const futureNegativeTransactions = fullLedgerRes.ledger.filter(
      (tx) => Number(tx.compliancePeriod) > selectedYear && Number(tx.complianceUnits) < 0
    )
    
    // Sum all compliance units up to the selected year
    const unitsUpToYear = transactionsUpToYear.reduce(
      (sum, tx) => sum + (Number(tx.complianceUnits) || 0), 
      0
    )
    
    // Sum all future negative units (these are already negative values)
    const futureNegativeUnits = futureNegativeTransactions.reduce(
      (sum, tx) => sum + (Number(tx.complianceUnits) || 0), 
      0
    )
    
    // Available balance = units up to year + future negative units
    // (futureNegativeUnits is already negative, so this subtracts them)
    return unitsUpToYear + futureNegativeUnits
  }

  const availableBalance = getAvailableBalanceForPeriod()

  const rowData = (ledgerRes?.ledger ?? []).map((r) => ({
    compliancePeriod: r.compliancePeriod,
    availableBalance: r.availableBalance,
    complianceUnits: r.complianceUnits,
    transactionType: r.transactionType,
    updateDate: r.updateDate
  }))

  const pg = ledgerRes?.pagination ?? {
    page: pagination.page,
    size: pagination.size,
    total: 0,
    totalPages: 0
  }

  const onPaginationChange = (newPg) =>
    setPagination((prev) => ({ ...prev, ...newPg }))

  const onPeriodChange = (e) => {
    setSelectedPeriod(e.target.value)
    setPagination({ page: 1, size: pagination.size })
  }

  // excel / csv download
  const downloadLedger = useDownloadCreditLedger()
  const handleDownload = useCallback(
    () =>
      downloadLedger({
        orgId: orgID,
        complianceYear: selectedPeriod || undefined
      }),
    [downloadLedger, orgID, selectedPeriod]
  )

  // Column defs
  const columnDefs = [
    {
      field: 'compliancePeriod',
      headerName: t('org:ledger.complianceYear'),
      minWidth: 130
    },
    {
      field: 'availableBalance',
      headerName: t('org:ledger.availableBalance'),
      minWidth: 170
    },
    {
      field: 'complianceUnits',
      headerName: t('org:ledger.complianceUnits'),
      minWidth: 150
    },
    {
      field: 'transactionType',
      headerName: t('org:ledger.transactionType'),
      minWidth: 160
    },
    {
      field: 'updateDate',
      headerName: t('org:ledger.transactionDate'),
      valueFormatter: timezoneFormatter,
      minWidth: 180
    }
  ]
  const getRowId = (p) =>
    `${p.data.updateDate}-${p.data.transactionType}-${p.data.complianceUnits}`

  return (
    <BCBox mt={2}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <BCTypography variant="h5" color="primary" mb={2}>
            {t('org:creditLedger')}
          </BCTypography>

          <DownloadButton
            onDownload={handleDownload}
            label={t('org:downloadExcel')}
            downloadLabel={t('org:downloading')}
            isDownloading={false}
            dataTest="download-credit-ledger"
          />
        </Grid>
        <Grid
          item
          xs={12}
          md={6}
          display="flex"
          flexDirection="column"
          alignItems={{ xs: 'flex-start', md: 'flex-end' }}
          justifyContent="center"
        >
          <BCTypography variant="body2" mb={1}>
            {selectedPeriod
              ? t('org:availableCreditBalanceForPeriod', {
                  year: selectedPeriod
                })
              : `Available credit balance: `}{' '}
            <strong>{availableBalance.toLocaleString()}</strong>
          </BCTypography>

          <BCBox display="flex" alignItems="center" gap={1}>
            <BCTypography variant="body2">
              {t('org:showTransactionsIn')}
            </BCTypography>

            <FormControl sx={{ width: 200 }}>
              <Select
                displayEmpty
                value={selectedPeriod}
                onChange={onPeriodChange}
                renderValue={(v) => (v === '' ? 'All years' : v)}
                sx={{
                  height: '46px',
                  '& .MuiSelect-select': {
                    height: '46px',
                    paddingTop: '0px',
                    paddingBottom: '0px'
                  }
                }}
              >
                <MenuItem value="">All years</MenuItem>
                {!periodsLoading &&
                  compliancePeriods.map((p) => (
                    <MenuItem
                      key={p.compliance_period_id}
                      value={p.description}
                    >
                      {p.description}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </BCBox>
        </Grid>
      </Grid>

      <BCBox mt={2} sx={{ width: '100%' }}>
        <BCGridViewer
          ref={gridRef}
          gridKey="credit-ledger-grid"
          queryData={{
            data: { ledger: rowData, pagination: pg },
            isLoading: ledgerLoading,
            isError: false,
            error: null
          }}
          dataKey="ledger"
          columnDefs={columnDefs}
          getRowId={getRowId}
          suppressPagination={false}
          paginationOptions={pg}
          onPaginationChange={onPaginationChange}
          defaultColDef={{
            filter: false,
            sortable: true,
            floatingFilter: false
          }}
          autoSizeStrategy={{ type: 'fitGridWidth' }}
        />
      </BCBox>
      <BCBox mt={4}>
        <BCTypography variant="body2">
          {t('org:availableCreditBalanceFootnote')}
        </BCTypography>
      </BCBox>
    </BCBox>
  )
}
