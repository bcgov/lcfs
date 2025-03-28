import PropTypes from 'prop-types'
// @mui components
import { TablePagination } from '@mui/material'
import { ArrowDropDown } from '@mui/icons-material'
import { BCPaginationActions } from './BCPaginationActions'

export const BCPagination = ({
  total = 0,
  page = 1,
  handleChangePage,
  size = 10,
  handleChangeRowsPerPage,
  enableResetButton = false,
  enableCopyButton = false,
  enableExportButton = false,
  exportName = 'ExportData',
  gridRef = null
}) => {
  return (
    <TablePagination
      className="ag-grid-pagination"
      aria-label="pagination for BC DataGrid"
      component="div"
      count={total}
      page={page - 1}
      onPageChange={handleChangePage}
      rowsPerPageOptions={[5, 10, 20, 25, 50, 100]}
      rowsPerPage={size}
      onRowsPerPageChange={handleChangeRowsPerPage}
      labelRowsPerPage={'Page Size:'}
      labelDisplayedRows={({ from, to, count }) => (
        <>
          <b>{from}</b>&nbsp;to&nbsp;<b>{to}</b>&nbsp;of&nbsp;
          <b>{count}</b>
        </>
      )}
      showFirstButton
      showLastButton
      ActionsComponent={(subProps) => (
        <BCPaginationActions
          {...subProps}
          enableResetButton={enableResetButton}
          enableCopyButton={enableCopyButton}
          enableExportButton={enableExportButton}
          exportName={exportName}
          gridRef={gridRef}
        />
      )}
      slots={{
        root: 'div',
        toolbar: 'nav'
      }}
      slotProps={{
        select: {
          IconComponent: (props) => (
            <ArrowDropDown
              fontSize="medium"
              sx={{ marginRight: '-8px', left: '34px' }}
              {...props}
            />
          )
        }
      }}
    />
  )
}

BCPagination.displayName = 'BCPagination'

BCPagination.propTypes = {
  enableCopyButton: PropTypes.bool,
  enableResetButton: PropTypes.bool,
  enableExportButton: PropTypes.bool,
  exportName: PropTypes.string,
  gridRef: PropTypes.object.isRequired,
  page: PropTypes.number.isRequired,
  size: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  handleChangePage: PropTypes.func.isRequired,
  handleChangeRowsPerPage: PropTypes.func.isRequired,
  rowsPerPageOptions: PropTypes.arrayOf(PropTypes.number)
}
