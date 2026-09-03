import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import BCBox from '@/components/BCBox'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import { useDesignatedActions } from '@/hooks/useInitiativeAgreements'
import { designatedActionColDefs } from '../_schema'

const initialPaginationOptions = {
  page: 1,
  size: 10,
  sortOrders: [],
  filters: []
}

// AG Grid of an agreement's designated actions (#4896). Rows navigate to
// the designated action detail route (#4840 builds the page itself).
export const DesignatedActionsGrid = ({ initiativeAgreementId }) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const gridRef = useRef(null)
  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )

  const queryData = useDesignatedActions(
    initiativeAgreementId,
    paginationOptions
  )

  const columnDefs = useMemo(
    () => designatedActionColDefs(t, initiativeAgreementId),
    [t, initiativeAgreementId]
  )

  const getRowId = (params) => params.data.designatedActionId.toString()

  const defaultColDef = useMemo(
    () => ({
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        // Relative to the agreement detail route.
        url: (data) => `designated-actions/${data.data.designatedActionId}`
      }
    }),
    []
  )

  return (
    <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
      <BCGridViewer
        gridRef={gridRef}
        gridKey="designated-actions-grid"
        columnDefs={columnDefs}
        getRowId={getRowId}
        overlayNoRowsTemplate={t('initiativeAgreement:actions.noActionsFound')}
        defaultColDef={defaultColDef}
        queryData={queryData}
        dataKey="designatedActions"
        paginationOptions={paginationOptions}
        onPaginationChange={(newPagination) =>
          setPaginationOptions((prev) => ({
            ...prev,
            ...newPagination
          }))
        }
      />
    </BCBox>
  )
}

export default DesignatedActionsGrid
