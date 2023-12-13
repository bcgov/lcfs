import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model'
import { AgGridReact } from '@ag-grid-community/react'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-alpine.css'
import { useMemo } from 'react'

import { ModuleRegistry } from '@ag-grid-community/core'

ModuleRegistry.registerModules([ClientSideRowModelModule])

const UserTable = ({ rowData = [] }) => {
  const columnDefs = [
    { headerName: 'Name', field: 'name' },
    { headerName: 'Role(s)', field: 'roles' },
    { headerName: 'Email', field: 'email' },
    { headerName: 'Phone', field: 'phone' },
    { headerName: 'Status', field: 'status' }
  ]

  const defaultColDef = useMemo(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
      floatingFilter: true,
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true
      }
    }),
    []
  )

  return (
    <div className="ag-theme-alpine" style={{ width: '100%', height: '100%' }}>
      <AgGridReact
        className="ag-theme-alpine"
        animateRows="true"
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        enableRangeSelection="true"
        rowData={rowData}
        rowSelection="multiple"
        suppressRowClickSelection="true"
        pagination
        paginationPageSize={10}
        domLayout="autoHeight"
      />
    </div>
  )
}

export default UserTable
