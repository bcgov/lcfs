import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { apiRoutes, ROUTES } from '@/constants/routes'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'

export const AllocationAgreementSummary = ({ data, status }) => {
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [gridKey, setGridKey] = useState(`allocation-agreements-grid`)
  const { complianceReportId, compliancePeriod } = useParams()

  const gridRef = useRef()
  const { t } = useTranslation(['common', 'allocationAgreement'])
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t(
        'allocationAgreement:noAllocationAgreementsFound'
      ),
      autoSizeStrategy: {
        type: 'fitCellContents',
        defaultMinWidth: 50,
        defaultMaxWidth: 600
      },
      enableCellTextSelection: true, // enables text selection on the grid
      ensureDomOrder: true
    }),
    [t]
  )

  const defaultColDef = useMemo(
    () => ({
      floatingFilter: false,
      filter: false,
      cellRenderer:
        status === COMPLIANCE_REPORT_STATUSES.DRAFT ? LinkRenderer : undefined,
      cellRendererParams: {
        url: () => 'allocation-agreements'
      }
    }),
    [status]
  )

  const columns = useMemo(
    () => [
      {
        headerName: t(
          'allocationAgreement:allocationAgreementColLabels.transaction'
        ),
        field: 'allocationTransactionType'
      },
      {
        headerName: t(
          'allocationAgreement:allocationAgreementColLabels.transactionPartner'
        ),
        field: 'transactionPartner'
      },
      {
        headerName: t(
          'allocationAgreement:allocationAgreementColLabels.postalAddress'
        ),
        field: 'postalAddress'
      },
      {
        headerName: t(
          'allocationAgreement:allocationAgreementColLabels.transactionPartnerEmail'
        ),
        field: 'transactionPartnerEmail'
      },
      {
        headerName: t(
          'allocationAgreement:allocationAgreementColLabels.transactionPartnerPhone'
        ),
        field: 'transactionPartnerPhone'
      },
      {
        headerName: t(
          'allocationAgreement:allocationAgreementColLabels.fuelType'
        ),
        field: 'fuelType'
      },
      {
        headerName: t(
          'allocationAgreement:allocationAgreementColLabels.fuelCategory'
        ),
        field: 'fuelCategory'
      },
      {
        headerName: t(
          'allocationAgreement:allocationAgreementColLabels.carbonIntensity'
        ),
        field: 'provisionOfTheAct'
      },
      {
        headerName: t(
          'allocationAgreement:allocationAgreementColLabels.fuelCode'
        ),
        field: 'fuelCode'
      },
      {
        headerName: t(
          'allocationAgreement:allocationAgreementColLabels.ciOfFuel'
        ),
        field: 'ciOfFuel'
      },
      {
        headerName: t(
          'allocationAgreement:allocationAgreementColLabels.quantity'
        ),
        field: 'quantity',
        valueFormatter
      },
      {
        headerName: t('allocationAgreement:allocationAgreementColLabels.units'),
        field: 'units'
      }
    ],
    [t]
  )

  const getRowId = (params) => {
    return params.data.allocationAgreementId.toString()
  }

  const handleGridKey = () => {
    setGridKey(`allocation-agreements-grid-${uuid()}`)
  }

  return (
    <Grid2 className="allocation-agreement-container" mx={-1}>
      <div>
        {alertMessage && (
          <BCAlert data-test="alert-box" severity={alertSeverity}>
            {alertMessage}
          </BCAlert>
        )}
      </div>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCDataGridServer
          className={'ag-theme-material'}
          gridRef={gridRef}
          apiEndpoint={apiRoutes.getAllAllocationAgreements}
          apiData={'allocationAgreements'}
          apiParams={{ complianceReportId }}
          columnDefs={columns}
          gridKey={gridKey}
          getRowId={getRowId}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
          enableCopyButton={false}
          defaultColDef={defaultColDef}
          suppressPagination={data.allocationAgreements.length <= 10}
        />
      </BCBox>
    </Grid2>
  )
}

AllocationAgreementSummary.displayName = 'AllocationAgreementSummary'
