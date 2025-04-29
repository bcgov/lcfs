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
import { useCurrentOrgBalance } from '@/hooks/useOrganization'
import { useCompliancePeriod } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTranslation } from 'react-i18next'
import { timezoneFormatter } from '@/utils/formatters'

export const CreditLedger = () => {
  const { t } = useTranslation(['org', 'common'])
  const gridRef = useRef(null)

  const { data: currentUser } = useCurrentUser()
  const orgID = currentUser?.organization?.organizationId

  const [pagination, setPagination] = useState({ page: 1, size: 10 })
  const [selectedPeriod, setSelectedPeriod] = useState('')

  const { data: periodsRes, isLoading: periodsLoading } = useCompliancePeriod()

  const allPeriods = periodsRes?.data ?? []
  const currentYear = new Date().getFullYear()
  const compliancePeriods = allPeriods
    .filter((p) => Number(p.description) <= currentYear)
    .sort((a, b) => Number(b.description) - Number(a.description))

  const { data: ledgerRes, isLoading: ledgerLoading } = useCreditLedger({
    orgId: orgID,
    page: pagination.page,
    size: pagination.size,
    period: selectedPeriod
  })

  const { data: orgBalance } = useCurrentOrgBalance()
  const availableBalance = orgBalance?.totalBalance ?? 0

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
            {t('org:availableCreditBalanceForPeriod', {
              year: currentYear - 1
            })}{' '}
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
                renderValue={(v) => (v === '' ? t('org:select') : v)}
                sx={{
                  height: '46px',
                  '& .MuiSelect-select': {
                    height: '46px',
                    paddingTop: '0px',
                    paddingBottom: '0px'
                  }
                }}
              >
                <MenuItem value="">{t('org:select')}</MenuItem>
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
