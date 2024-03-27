import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model'
import { ModuleRegistry } from '@ag-grid-community/core'
import { AgGridReact } from '@ag-grid-community/react'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-alpine.css'
import { useMemo } from 'react'

ModuleRegistry.registerModules([ClientSideRowModelModule])

export const BCTable = ({ columnDefs, rowData, ...rest }) => {
  const defaultColDef = useMemo(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
      floatingFilter: true
      // filterParams: {
      //   buttons: ['apply', 'reset'],
      //   closeOnApply: true,
      // }
    }),
    []
  )

  // const [rowData, setRowData] = useState();

  // useEffect(() => {
  //   // fetch('https://www.ag-grid.com/example-assets/olympic-winners.json')
  //   //   .then(resp => resp.json())
  //   //   .then(data => setRowData(data));
  //   setRowData([...props.data]);
  // }, []);

  return (
    <div className="ag-theme-alpine" style={{ width: '100%', height: '100%' }}>
      <AgGridReact
        className="ag-theme-alpine"
        animateRows="true"
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowData={rowData}
        rowSelection="multiple"
        suppressRowClickSelection="true"
        pagination
        paginationPageSize={10}
        domLayout="autoHeight"
        paginationPageSizeSelector={[10, 20, 50, 100]}
        {...rest}
      />
    </div>
  )
}
