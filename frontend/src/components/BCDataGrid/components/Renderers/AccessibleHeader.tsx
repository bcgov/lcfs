export interface AccessibleHeaderProps {
  column: {
    colDef: {
      headerName?: string
    }
  }
}

export const AccessibleHeader = (props: AccessibleHeaderProps) => {
  return (
    <div role="columnheader" aria-label={props.column.colDef.headerName} data-ref="columnWrapper">
      <span className="ag-header-cell-text">{props.column.colDef.headerName}</span>
    </div>
  )
}
