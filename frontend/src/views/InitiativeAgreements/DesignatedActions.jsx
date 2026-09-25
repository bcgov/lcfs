import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Divider } from '@mui/material'

import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { roles } from '@/constants/roles'
import withRole from '@/utils/withRole'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import { ROUTES } from '@/routes/routes'

import { useAllDesignatedActions } from '@/hooks/useInitiativeAgreements'
import { allDesignatedActionColDefs } from './_schema'
import InitiativeAgreementTabs from './components/InitiativeAgreementTabs'

// Every designated action across every agreement, newest activity first
// (#5078). The agreement grid answers "what agreements exist"; this one
// answers "what needs attention", so it is a work queue: sorted by last
// updated unless the analyst sorts otherwise.
export const defaultActionsSortModel = [
  { field: 'updateDate', direction: 'desc' }
]

const initialPaginationOptions = {
  page: 1,
  size: 10,
  sortOrders: defaultActionsSortModel,
  filters: []
}

const DesignatedActionsBase = () => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const gridRef = useRef(null)
  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )
  const [alertMessage, setAlertMessage] = useState('')

  const queryData = useAllDesignatedActions(paginationOptions)
  const columnDefs = useMemo(() => allDesignatedActionColDefs(t), [t])

  useEffect(() => {
    if (queryData.isError && queryData.error) {
      setAlertMessage(
        queryData.error.message || t('initiativeAgreement:actions.loadFailMsg')
      )
    }
  }, [queryData.isError, queryData.error, t])

  const getRowId = (params) => params.data.designatedActionId.toString()

  const defaultColDef = useMemo(
    () => ({
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        // Absolute: the action's page lives under its agreement, not
        // under this tab. Without the flag the renderer prefixes the
        // current route and the link doubles up.
        isAbsolute: true,
        url: (data) =>
          ROUTES.INITIATIVE_AGREEMENTS.ACTION_VIEW.replace(
            ':initiativeAgreementId',
            String(data.data.initiativeAgreementId)
          ).replace(':designatedActionId', String(data.data.designatedActionId))
      }
    }),
    []
  )

  return (
    <BCBox>
      <InitiativeAgreementTabs />
      {alertMessage && (
        <BCAlert data-test="alert-box" severity="error">
          {alertMessage}
        </BCAlert>
      )}
      <BCTypography
        variant="h5"
        color="primary"
        data-test="designated-actions-title"
      >
        {t('initiativeAgreement:actions.tabTitle')}
      </BCTypography>
      <Divider sx={{ mt: 2, mb: 3 }} />
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridRef={gridRef}
          gridKey="all-designated-actions-grid"
          columnDefs={columnDefs}
          getRowId={getRowId}
          overlayNoRowsTemplate={t(
            'initiativeAgreement:actions.noActionsFound'
          )}
          defaultColDef={defaultColDef}
          queryData={queryData}
          dataKey="designatedActions"
          paginationOptions={paginationOptions}
          onPaginationChange={(newPagination) =>
            setPaginationOptions((prev) => ({ ...prev, ...newPagination }))
          }
        />
      </BCBox>
    </BCBox>
  )
}

// IDIR only: the endpoint refuses proponents, and the BCeID stories will
// decide what, if anything, a proponent sees here.
export const DesignatedActions = withRole(
  DesignatedActionsBase,
  [roles.ia_analyst, roles.ia_manager, roles.director],
  ROUTES.DASHBOARD
)
DesignatedActions.displayName = 'DesignatedActions'

export default DesignatedActions
