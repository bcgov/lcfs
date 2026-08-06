import React, { useState, useCallback } from 'react'
import {
  Box,
  IconButton,
  FormControlLabel,
  Switch,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow
} from '@mui/material'
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material'
import { useTranslation } from 'react-i18next'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import BCAlert from '@/components/BCAlert'
import { DownloadButton } from '@/components/DownloadButton'
import {
  usePeriodCreditLedger,
  useDownloadCreditLedger,
  useCreditLedgerYears
} from '@/hooks/useCreditLedger'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { dateFormatter, formatTransactionId } from '@/utils/formatters'

const TYPE_LABELS = {
  Transfer: 'Transfer',
  InitiativeAgreement: 'Initiative Agreement',
  AdminAdjustment: 'Administrative Adjustment',
  ComplianceReport: 'Compliance Report',
  AggregatorIssuance: 'Aggregator Issuance',
  StandaloneTransaction: 'Legacy Transaction'
}

const formatType = (txn) => {
  const base = TYPE_LABELS[txn.transactionType] || txn.transactionType
  if (txn.transactionType === 'ComplianceReport' && txn.description) {
    return `${base} - ${txn.description}`
  }
  return base
}

const formatUnits = (n) => (n ? Number(n).toLocaleString() : '-')
const formatDate = (iso) => (iso ? dateFormatter({ value: iso }) : '-')

const cellSx = {
  py: 1.25,
  borderBottom: '1px solid',
  borderColor: 'divider',
  whiteSpace: 'nowrap'
}

// A right-aligned number cell. Negatives are not colour-coded: red read as
// alarming for what are ordinary deficits.
//
// `blankIfNull` is for the assessed balances, which are absent (not zero) for a
// year with no assessed report — showing 0 there would read as a real balance.
const NumberCell = ({
  value,
  bold = false,
  dataTest,
  align = 'right',
  blankIfNull = false,
  sx
}) => (
  <TableCell
    align={align}
    data-test={dataTest}
    sx={{
      ...cellSx,
      fontWeight: bold ? 700 : 400,
      ...sx
    }}
  >
    {blankIfNull && value == null ? '' : Number(value ?? 0).toLocaleString()}
  </TableCell>
)

const headerSx = {
  fontWeight: 700,
  whiteSpace: 'nowrap',
  backgroundColor: 'grey.100',
  borderBottom: '2px solid',
  borderColor: 'grey.400',
  py: 1.25
}
// Zebra striping + hover for readability on long ledgers.
const bodyRowSx = {
  '&:nth-of-type(even)': { backgroundColor: 'grey.50' },
  '&:hover': { backgroundColor: 'action.hover' }
}
const groupRowSx = { backgroundColor: 'grey.100' }
// Assessed-balance rows sit in a small summary table with rule lines.
const assessedCellSx = {
  py: 1.5,
  borderTop: '1px solid',
  borderColor: 'grey.400'
}

export const CreditLedgerPeriod = ({ organizationId }) => {
  const { t } = useTranslation(['org', 'common'])

  const { data: currentUser } = useCurrentUser()
  const orgID = organizationId ?? currentUser?.organization?.organizationId

  const [selectedYear, setSelectedYear] = useState(null)
  const [showTotals, setShowTotals] = useState(false)
  const [showPending, setShowPending] = useState(false)

  const { data: availableYears = [] } = useCreditLedgerYears(orgID)
  const numericYears = availableYears
    .map(Number)
    .filter((n) => Number.isFinite(n))

  const currentCalendarYear = new Date().getFullYear()
  const defaultYear = numericYears.length
    ? Math.max(...numericYears)
    : currentCalendarYear
  const year = selectedYear ?? defaultYear

  const minYear = numericYears.length
    ? Math.min(...numericYears)
    : currentCalendarYear
  const maxYear = Math.max(currentCalendarYear, ...numericYears, defaultYear)

  const {
    data: ledger,
    isLoading,
    isError
  } = usePeriodCreditLedger({
    orgId: orgID,
    complianceYear: year,
    includePending: showPending
  })

  const transactions = ledger?.transactions ?? []
  const totalsByType = ledger?.totalsByType ?? []
  const assessed = ledger?.assessedBalance

  const goPrev = () => setSelectedYear(year - 1)
  const goNext = () => setSelectedYear(year + 1)

  const downloadLedger = useDownloadCreditLedger()
  const handleDownload = useCallback(
    () => downloadLedger({ orgId: orgID, complianceYear: year }),
    [downloadLedger, orgID, year]
  )

  const runningBalanceHeader = t('org:ledger.runningBalance', { year })

  return (
    <BCBox mt={1} data-test="credit-ledger">
      {/* Controls: toggles (left) + period navigation (right) */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={showTotals}
                onChange={(e) => setShowTotals(e.target.checked)}
                data-test="toggle-show-totals"
              />
            }
            label={t('org:ledger.showTotals')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={showPending}
                onChange={(e) => setShowPending(e.target.checked)}
                data-test="toggle-show-pending"
              />
            }
            label={t('org:ledger.showPending')}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DownloadButton
            onDownload={handleDownload}
            label={t('org:downloadExcel')}
            downloadLabel={t('org:downloading')}
            isDownloading={false}
            dataTest="download-credit-ledger"
          />
          <IconButton
            onClick={goPrev}
            disabled={year <= minYear}
            aria-label={t('org:ledger.previousPeriod')}
            data-test="ledger-prev-period"
          >
            <ChevronLeftIcon />
          </IconButton>
          <BCTypography
            variant="h5"
            component="span"
            data-test="ledger-current-period"
            sx={{ minWidth: 64, textAlign: 'center', fontWeight: 700 }}
          >
            {year}
          </BCTypography>
          <IconButton
            onClick={goNext}
            disabled={year >= maxYear}
            aria-label={t('org:ledger.nextPeriod')}
            data-test="ledger-next-period"
          >
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </Box>

      {isError && (
        <BCAlert severity="error" data-test="ledger-error">
          {t('org:ledger.errorLoading')}
        </BCAlert>
      )}

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <Table size="small" data-test="ledger-table">
            <TableHead>
              <TableRow>
                <TableCell sx={headerSx}>{t('org:ledger.id')}</TableCell>
                <TableCell sx={headerSx}>
                  {t('org:ledger.effectiveDate')}
                </TableCell>
                <TableCell sx={headerSx}>
                  {t('org:ledger.transactionType')}
                </TableCell>
                <TableCell align="right" sx={headerSx}>
                  {t('org:ledger.unitsIn')}
                </TableCell>
                <TableCell align="right" sx={headerSx}>
                  {t('org:ledger.unitsOut')}
                </TableCell>
                <TableCell align="right" sx={headerSx}>
                  {showTotals ? t('org:ledger.total') : runningBalanceHeader}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={cellSx} data-test="ledger-empty">
                    {t('org:ledger.noTransactions')}
                  </TableCell>
                </TableRow>
              )}

              {!showTotals &&
                transactions.map((txn) => (
                  <TableRow
                    key={`${txn.transactionType}-${txn.transactionId}`}
                    sx={bodyRowSx}
                  >
                    <TableCell sx={cellSx}>
                      {formatTransactionId(
                        txn.transactionType,
                        txn.transactionId
                      )}
                    </TableCell>
                    <TableCell sx={cellSx}>
                      {formatDate(txn.effectiveDate)}
                    </TableCell>
                    <TableCell sx={cellSx}>
                      {formatType(txn)}
                      {txn.isPending && (
                        <Chip
                          size="small"
                          label={t('org:ledger.pending')}
                          data-test="ledger-pending-chip"
                          sx={{ ml: 1, height: 20 }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right" sx={cellSx}>
                      {formatUnits(txn.unitsIn)}
                    </TableCell>
                    <TableCell align="right" sx={cellSx}>
                      {formatUnits(txn.unitsOut)}
                    </TableCell>
                    <NumberCell
                      value={txn.runningBalance}
                      dataTest="ledger-running-balance"
                    />
                  </TableRow>
                ))}

              {showTotals &&
                totalsByType.map((group) => (
                  <React.Fragment key={group.transactionType}>
                    {transactions
                      .filter(
                        (txn) => txn.transactionType === group.transactionType
                      )
                      .map((txn) => (
                        <TableRow
                          key={`${txn.transactionType}-${txn.transactionId}`}
                          sx={bodyRowSx}
                        >
                          <TableCell sx={cellSx}>
                            {formatTransactionId(
                              txn.transactionType,
                              txn.transactionId
                            )}
                          </TableCell>
                          <TableCell sx={cellSx}>
                            {formatDate(txn.effectiveDate)}
                          </TableCell>
                          <TableCell sx={cellSx}>{formatType(txn)}</TableCell>
                          <TableCell align="right" sx={cellSx}>
                            {formatUnits(txn.unitsIn)}
                          </TableCell>
                          <TableCell align="right" sx={cellSx}>
                            {formatUnits(txn.unitsOut)}
                          </TableCell>
                          <TableCell align="right" sx={cellSx}>
                            -
                          </TableCell>
                        </TableRow>
                      ))}
                    <TableRow sx={groupRowSx} data-test="ledger-type-total">
                      <TableCell
                        sx={{ ...cellSx, fontWeight: 700 }}
                        colSpan={3}
                      >
                        {t('org:ledger.typeTotal', {
                          type:
                            TYPE_LABELS[group.transactionType] ||
                            group.transactionType
                        })}
                      </TableCell>
                      <NumberCell value={group.unitsIn} bold />
                      <NumberCell value={group.unitsOut} bold />
                      <NumberCell value={group.net} bold />
                    </TableRow>
                  </React.Fragment>
                ))}

              {showTotals && transactions.length > 0 && (
                <TableRow sx={groupRowSx} data-test="ledger-grand-total">
                  <TableCell sx={{ ...cellSx, fontWeight: 700 }} colSpan={3}>
                    {t('org:ledger.totalInOut')}
                  </TableCell>
                  <NumberCell value={ledger?.totalUnitsIn} bold />
                  <NumberCell value={ledger?.totalUnitsOut} bold />
                  <NumberCell value={ledger?.totalNet} bold />
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Assessed balance section */}
          {assessed && (
            <Table
              size="small"
              sx={{ mt: 4, maxWidth: 640 }}
              data-test="ledger-assessed-balance"
            >
              <TableBody>
                <TableRow>
                  <TableCell sx={{ ...assessedCellSx, fontWeight: 700 }}>
                    {t('org:ledger.assessedBalance', {
                      year: assessed.previousYear
                    })}
                  </TableCell>
                  <NumberCell
                    value={assessed.previousBalance}
                    bold
                    blankIfNull
                    sx={assessedCellSx}
                    dataTest="assessed-previous"
                  />
                </TableRow>
                <TableRow>
                  <TableCell sx={{ ...assessedCellSx, fontWeight: 700 }}>
                    {t('org:ledger.assessedBalance', {
                      year: assessed.currentYear
                    })}
                  </TableCell>
                  <NumberCell
                    value={assessed.currentBalance}
                    bold
                    blankIfNull
                    sx={assessedCellSx}
                    dataTest="assessed-current"
                  />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </>
      )}
    </BCBox>
  )
}
