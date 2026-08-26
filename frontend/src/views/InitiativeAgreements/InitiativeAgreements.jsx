import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { Divider, Stack } from '@mui/material'

import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { roles } from '@/constants/roles'
import withRole from '@/utils/withRole'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import { ROUTES } from '@/routes/routes'

import { useGetInitiativeAgreements } from '@/hooks/useInitiativeAgreements'
import { defaultSortModel, initiativeAgreementColDefs } from './_schema'
import CreateAgreement from './components/CreateAgreement'

const initialPaginationOptions = {
  page: 1,
  size: 10,
  sortOrders: defaultSortModel,
  filters: []
}

const InitiativeAgreementsBase = () => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const location = useLocation()
  const gridRef = useRef(null)

  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const queryData = useGetInitiativeAgreements(paginationOptions)

  const columnDefs = useMemo(() => initiativeAgreementColDefs(t), [t])

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  useEffect(() => {
    if (queryData.isError && queryData.error) {
      setAlertMessage(
        queryData.error.message || t('initiativeAgreement:loadFailMsg')
      )
      setAlertSeverity('error')
    }
  }, [queryData.isError, queryData.error, t])

  const getRowId = (params) => params.data.initiativeAgreementId.toString()

  const defaultColDef = useMemo(
    () => ({
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        // Relative to /initiative-agreements -> the agreement detail route
        url: (data) => `${data.data.initiativeAgreementId}`
      }
    }),
    []
  )

  return (
    <BCBox>
      {alertMessage && (
        <BCAlert data-test="alert-box" severity={alertSeverity}>
          {alertMessage}
        </BCAlert>
      )}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        gap={2}
      >
        <BCTypography
          variant="h5"
          color="primary"
          data-test="initiative-agreements-title"
        >
          {t('InitiativeAgreements')}
        </BCTypography>
        <CreateAgreement />
      </Stack>
      <Divider sx={{ mt: 2, mb: 3 }} />
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridRef={gridRef}
          gridKey="initiative-agreements-grid"
          columnDefs={columnDefs}
          getRowId={getRowId}
          overlayNoRowsTemplate={t('initiativeAgreement:noAgreementsFound')}
          defaultColDef={defaultColDef}
          queryData={queryData}
          dataKey="initiativeAgreements"
          paginationOptions={paginationOptions}
          onPaginationChange={(newPagination) =>
            setPaginationOptions((prev) => ({
              ...prev,
              ...newPagination
            }))
          }
        />
      </BCBox>
    </BCBox>
  )
}

export const InitiativeAgreements = withRole(
  InitiativeAgreementsBase,
  [roles.ia_proponent, roles.ia_analyst, roles.ia_manager, roles.director],
  ROUTES.DASHBOARD
)
InitiativeAgreements.displayName = 'InitiativeAgreements'
