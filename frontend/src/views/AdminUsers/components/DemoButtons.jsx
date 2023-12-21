import { useCallback } from 'react'
import PropTypes from 'prop-types'
import { Stack } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRedo } from '@fortawesome/free-solid-svg-icons'
import BCButton from '@/components/BCButton'

const DemoButtons = ({ handleGridKey, gridRef }) => {
  // Reload grid
  const reloadGrid = useCallback(() => {
    // Trigger re-load by assigning a new key to the Grid React component
    handleGridKey()
  }, [handleGridKey])
  // Sort by user name
  const sortByUserName = useCallback(() => {
    gridRef.current.api.applyColumnState({
      state: [{ colId: 'display_name', sort: 'desc' }],
      defaultState: { sort: null }
    })
  }, [gridRef])

  // Show active users
  const showActiveUsers = useCallback(() => {
    const filterInstance = gridRef.current.api.getFilterInstance('is_active')
    filterInstance.setModel({
      filterType: 'text',
      type: 'true'
    })
    gridRef.current.api.onFilterChanged()
  }, [gridRef])

  return (
    <Stack
      component="div"
      className="ag-root-wrapper"
      direction={{ md: 'coloumn', lg: 'row' }}
      spacing={{ xs: 2, sm: 2, md: 3 }}
      p={2}
      useFlexGap
      flexWrap="wrap"
      my={2}
    >
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
      <BCButton
        id="userNameSort"
        onClick={sortByUserName}
        variant="outlined"
        color="smoky"
        size="small"
        sx={{ borderRadius: '24px' }}
      >
        Name Descending
      </BCButton>
      <BCButton
        id="userNameSort"
        onClick={showActiveUsers}
        variant="outlined"
        color="smoky"
        size="small"
        sx={{ borderRadius: '24px' }}
      >
        Active Users
      </BCButton>
      <div className="example-header">
        Selection:&nbsp;
        <span
          id="selectedRows"
          style={{ fontSize: '20px', fontWeight: 'bold' }}
        ></span>
      </div>
    </Stack>
  )
}

DemoButtons.propTypes = {
  gridRef: PropTypes.oneOfType([
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    PropTypes.func
  ]).isRequired,
  handleGridKey: PropTypes.func.isRequired
}

export default DemoButtons
