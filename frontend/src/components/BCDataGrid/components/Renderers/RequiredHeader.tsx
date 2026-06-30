export interface RequiredHeaderProps {
  column: {
    colDef: {
      headerName?: string
    }
  }
}

export const RequiredHeader = (props: RequiredHeaderProps) => {
  return (
    <div role="columnheader" aria-label={props.column.colDef.headerName}>
      <span style={{ color: 'red' }}>*</span>
      <span className="ag-header-cell-text">{props.column.colDef.headerName}</span>
    </div>
  )
}
