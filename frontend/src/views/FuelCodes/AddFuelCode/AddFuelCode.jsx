import BCBox from '@/components/BCBox'
import { columnDefs, defaultColDef } from './_schema'
import { useRef, useState, useCallback } from 'react'
import BCDataGridEditor from '@/components/BCDataGrid/BCDataGridEditor'
import { Typography } from '@mui/material'

export const AddFuelCode = () => {
  const [rowData, setRowData] = useState(null)
  const [gridApi, setGridApi] = useState(null)
  const [columnApi, setColumnApi] = useState(null)
  const gridRef = useRef(null)

  function onGridReady(params) {
    setGridApi(params.api)
    setColumnApi(params.columnApi)

    fetch('http://localhost:4000/fuelCodes')
      .then((res) => res.json())
      .then((data) => {
        setRowData(data.slice(0, 100))
      })
    params.api.sizeColumnsToFit()
  }
  const saveData = useCallback(() => {
    const allRowData = []
    gridApi.forEachNode((node) => allRowData.push(node.data))
    const modifiedRows = allRowData.filter((row) => row.modified)
    console.log(modifiedRows)
    // Add your API call to save modified rows here
  }, [])

  return (
    <div>
      <div className="example-header">
        <Typography variant="h5">Fuel Codes</Typography>
      </div>
      <BCBox
        my={2}
        component="div"
        className="ag-theme-alpine"
        style={{ height: '100%', width: '100%' }}
      >
        <BCDataGridEditor
          gridRef={gridRef}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          rowData={rowData}
          gridApi={gridApi}
          columnApi={columnApi}
          getRowNodeId={(data) => data.id}
          saveData={saveData}
        />
      </BCBox>
    </div>
  )
}
