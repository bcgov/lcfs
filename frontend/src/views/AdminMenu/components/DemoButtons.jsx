import { useCallback } from 'react'
import PropTypes from 'prop-types'
import { Stack } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRedo } from '@fortawesome/free-solid-svg-icons'
import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'

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

  const showLoading = useCallback(() => {
    gridRef.current.api.showLoadingOverlay()
  }, [gridRef])

  const hideOverlay = useCallback(() => {
    gridRef.current.api.hideOverlay()
  }, [gridRef])

  return (
    <BCBox
      p={1}
      m={1}
      className="ag-root-wrapper"
      sx={{ height: '120px', backgroundColor: 'white.main' }}
    >
      <BCTypography variant="body1">Adding for demo purpose only</BCTypography>
      <Stack
        component="div"
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
          Reload
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
          id="activeUsers"
          onClick={showActiveUsers}
          variant="outlined"
          color="smoky"
          size="small"
          sx={{ borderRadius: '24px' }}
        >
          Active Users
        </BCButton>
        <BCButton
          id="showLoading"
          onClick={showLoading}
          variant="outlined"
          color="smoky"
          size="small"
          sx={{ borderRadius: '24px' }}
        >
          Show Loading Overlay
        </BCButton>
        <BCButton
          id="hideOverlay"
          onClick={hideOverlay}
          variant="outlined"
          color="smoky"
          size="small"
          sx={{ borderRadius: '24px' }}
        >
          Hide Overlay
        </BCButton>
        <div className="example-header">
          Selection:&nbsp;
          <span
            id="selectedRows"
            style={{ fontSize: '20px', fontWeight: 'bold' }}
          ></span>
        </div>
      </Stack>
    </BCBox>
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
