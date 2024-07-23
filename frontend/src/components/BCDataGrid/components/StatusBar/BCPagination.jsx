import PropTypes from 'prop-types'
// @mui components
import { TablePagination } from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { BCPaginationActions } from './BCPaginationActions'

export const BCPagination = ({
  total,
  page,
  handleChangePage,
  size,
  handleChangeRowsPerPage,
  enableResetButton,
  enableCopyButton,
  enableExportButton,
  exportName,
  gridRef
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
              <ArrowDropDownIcon
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

BCPagination.defaultProps = {
  enableCopyButton: false,
  enableResetButton: false,
  enableExportButton: false,
  exportName: 'ExportData',
  page: 1,
  size: 10,
  total: 0,
  gridRef: null,
  rowsPerPageOptions: [10, 20, 50, 100]
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

