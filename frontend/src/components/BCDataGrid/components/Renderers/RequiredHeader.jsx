export const RequiredHeader = (props) => {
  return (
    <div role="columnheader" aria-label={props.column.colDef.headerName}>
      <span style={{ color: 'red' }}>*</span>
      <span className="ag-header-cell-text">{props.column.colDef.headerName}</span>
    </div>
  )
}
