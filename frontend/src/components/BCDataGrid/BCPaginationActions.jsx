/* eslint-disable react-hooks/exhaustive-deps */
import PropTypes from 'prop-types'
import { useCallback, useState } from 'react'
// icons
import { Replay, ContentCopy } from '@mui/icons-material'
// mui components
import BCBox from '@/components/BCBox'
import { Pagination, IconButton, Tooltip } from '@mui/material'

export function BCPaginationActions({
  count,
  page,
  rowsPerPage,
  onPageChange,
  handleResetState,
  gridRef
}) {
  const [currentPage, setCurrentPage] = useState(page + 1)
  // Reload grid
  const reloadGrid = useCallback(() => {
    // Trigger re-load by assigning a new key to the Grid React component
    handleResetState()
    // TODO: clear custom filters
  }, [handleResetState])

  const handleCopyData = useCallback(() => {
    const selectedRows = gridRef.current.api.getDataAsCsv({
      allColumns: true,
      onlySelected: true,
      skipColumnHeaders: true
    })
    navigator.clipboard.writeText(selectedRows)
  })

  const handlePageChange = useCallback((event, newPage) => {
    if (currentPage === newPage) {
      return
    }
    setCurrentPage(newPage)
    gridRef.current.api.showLoadingOverlay()
    onPageChange(event, newPage - 1)
  })

  return (
    <BCBox
      sx={{ flexShrink: 0, ml: 2.5, display: 'flex', alignItems: 'center' }}
    >
      <Pagination
        component="div"
        count={Math.ceil(count / rowsPerPage)}
        color="primary"
        page={page + 1}
        onChange={handlePageChange}
      />
      {handleResetState && (
        <>
          <Tooltip title="Reset sort and filters" placement="top-start">
            <IconButton
              id="reloadGridBCButton"
              aria-label="delete"
              onClick={reloadGrid}
              color="primary"
            >
              <Replay />
            </IconButton>
          </Tooltip>
          <Tooltip title="Copy selected rows" placement="top-start">
            <IconButton
              id="reloadGridBCButton"
              aria-label="delete"
              onClick={handleCopyData}
              color="primary"
            >
              <ContentCopy />
            </IconButton>
          </Tooltip>
        </>
      )}
    </BCBox>
  )
}

BCPaginationActions.propTypes = {
  count: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  page: PropTypes.number.isRequired,
  rowsPerPage: PropTypes.number.isRequired,
  handleResetState: PropTypes.func
}
