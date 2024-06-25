export const HeaderComponent = (props) => {
  return (
    <div>
      <span>{props.column.colDef.headerName}</span>
      <span style={{ color: 'red' }}>*</span>
    </div>
  )
}
