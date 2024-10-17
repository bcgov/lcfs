export const RequiredHeader = (props) => {
  return (
    <div>
      <span style={{ color: 'red' }}>*</span>
      <span>{props.column.colDef.headerName}</span>
    </div>
  )
}
