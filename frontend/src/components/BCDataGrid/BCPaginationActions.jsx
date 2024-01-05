import PropTypes from 'prop-types'
import { useCallback } from 'react'
// icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRedo } from '@fortawesome/free-solid-svg-icons'
// mui components
import BCBox from '@/components/BCBox'
import { Pagination } from '@mui/material'
import BCButton from '../BCButton'

export function BCPaginationActions(props) {
  const { count, page, rowsPerPage, onPageChange, handleResetState } = props
  // Reload grid
  const reloadGrid = useCallback(() => {
    // Trigger re-load by assigning a new key to the Grid React component
    handleResetState()
  }, [handleResetState])

  const handlePageChange = useCallback((event, newPage) => {
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
        <BCButton
          id="reloadGridBCButton"
          onClick={reloadGrid}
          variant="outlined"
          color="smoky"
          size="small"
          sx={{ borderRadius: '24px', marginLeft: '1rem' }}
          startIcon={<FontAwesomeIcon icon={faRedo} className="small-icon" />}
        >
          Reset
        </BCButton>
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
