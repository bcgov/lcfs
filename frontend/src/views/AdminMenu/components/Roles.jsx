// @mui component
import BCTypography from '@/components/BCTypography'
import BCBox from '@/components/BCBox'
// react components
import { useCallback, useRef } from 'react'

import { rolesColumnDefs, rolesDefaultColDef } from './schema'
import BCDataGridClient from '@/components/BCDataGrid/BCDataGridClient'

export const Roles = (props) => {
  const gridRef = useRef()
  const gridOptions = {
    overlayNoRowsTemplate: 'No roles found',
    suppressMenuHide: false,
    paginationPageSize: 20
  }

  const getRowId = useCallback((params) => {
    return params.data.role_id
  }, [])

  return (
    <BCBox component="div">
      <BCTypography variant="h5" my={1} color="primary">
        Roles
      </BCTypography>
      <BCBox
        my={2}
        component="div"
        className="ag-theme-alpine"
        style={{ height: '100%', width: '100%' }}
      >
        <BCDataGridClient
          gridRef={gridRef}
          apiEndpoint={'roles/list'}
          defaultColDef={rolesDefaultColDef}
          columnDefs={rolesColumnDefs}
          gridKey={'roles-grid'}
          getRowId={getRowId}
          gridOptions={gridOptions}
        />
      </BCBox>
    </BCBox>
  )
}

Roles.propTypes = {}
