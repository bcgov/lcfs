export const AccessibleHeader = (props) => {
  return (
    <div role="columnheader" aria-label={props.column.colDef.headerName} data-ref="columnWrapper">
      <span className="ag-header-cell-text">{props.column.colDef.headerName}</span>
    </div>
  )
}
