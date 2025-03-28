import PropTypes from 'prop-types'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import BCTypography from '@/components/BCTypography'
import colors from '@/themes/base/colors'
import borders from '@/themes/base/borders'

const Loading = ({ message = 'Loading...', fixed = false }) => {
  return (
    <Box
      className="text-center"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        zIndex: 99999,
        position: fixed ? 'fixed' : 'relative',
        top: fixed && 0,
        left: fixed && 0,
        margin: fixed ? 0 : '10px'
      }}
      data-test="loading"
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          border: fixed ? `1px solid ${colors.primary.main}` : undefined,
          borderRadius: fixed ? borders.borderRadius.lg : undefined,
          padding: fixed && '20px',
          background: fixed && 'white'
        }}
      >
        <CircularProgress aria-labelledby="loading" />
        <BCTypography variant="subtitle1" sx={{ mt: 2 }} data-test="message">
          {message}
        </BCTypography>
      </Box>
    </Box>
  )
}

Loading.propTypes = {
  message: PropTypes.string
}

export default Loading
