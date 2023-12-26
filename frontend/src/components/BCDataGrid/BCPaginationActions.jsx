import PropTypes from 'prop-types'
import { useTheme } from '@mui/material/styles'
import { useCallback } from 'react'
// icons
import IconButton from '@mui/material/IconButton'
import FirstPageIcon from '@mui/icons-material/FirstPage'
import { KeyboardArrowLeft, KeyboardArrowRight } from '@mui/icons-material'
import LastPageIcon from '@mui/icons-material/LastPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRedo } from '@fortawesome/free-solid-svg-icons'
// mui components
import BCBox from '@/components/BCBox'
import { TextField } from '@mui/material'
import BCButton from '../BCButton'

export function BCPaginationActions(props) {
  const theme = useTheme()
  const { count, page, rowsPerPage, onPageChange, handleResetState } = props
  // Reload grid
  const reloadGrid = useCallback(() => {
    // Trigger re-load by assigning a new key to the Grid React component
    handleResetState()
  }, [handleResetState])

  const handleFirstPageButtonClick = (event) => {
    onPageChange(event, 0)
  }

  const handleBackButtonClick = (event) => {
    onPageChange(event, page - 1)
  }

  const handleNextButtonClick = (event) => {
    onPageChange(event, page + 1)
  }

  const handleLastPageButtonClick = (event) => {
    onPageChange(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1))
  }

  const handlePageNumberChange = (event) => {
    const newPage = parseInt(event.target.value, 10)
    if (newPage >= 0 && newPage < Math.ceil(count / rowsPerPage)) {
      onPageChange(event, newPage - 1)
    }
  }

  return (
    <BCBox sx={{ flexShrink: 0, ml: 2.5 }}>
      <IconButton
        onClick={handleFirstPageButtonClick}
        disabled={page === 0}
        aria-label="first page"
      >
        {theme.direction === 'rtl' ? <LastPageIcon /> : <FirstPageIcon />}
      </IconButton>
      <IconButton
        onClick={handleBackButtonClick}
        disabled={page === 0}
        aria-label="previous page"
      >
        {theme.direction === 'rtl' ? (
          <KeyboardArrowRight />
        ) : (
          <KeyboardArrowLeft />
        )}
      </IconButton>
      <TextField
        sx={{
          '& .MuiOutlinedInput-input': {
            fontSize: '1rem',
            width: '2.2rem',
            padding: '0.4rem'
          }
        }}
        value={page + 1}
        size="small"
        onChange={handlePageNumberChange}
        inputProps={{
          min: 1,
          max: Math.ceil(count / rowsPerPage),
          type: 'number',
          'aria-label': 'page number'
        }}
      />
      <IconButton
        onClick={handleNextButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="next page"
      >
        {theme.direction === 'rtl' ? (
          <KeyboardArrowLeft />
        ) : (
          <KeyboardArrowRight />
        )}
      </IconButton>
      <IconButton
        onClick={handleLastPageButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="last page"
      >
        {theme.direction === 'rtl' ? <FirstPageIcon /> : <LastPageIcon />}
      </IconButton>
      {handleResetState && (
        <BCButton
          id="reloadGridBCButton"
          onClick={reloadGrid}
          variant="outlined"
          color="smoky"
          size="small"
          sx={{ borderRadius: '24px' }}
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
