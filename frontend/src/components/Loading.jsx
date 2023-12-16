import PropTypes from 'prop-types'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

const Loading = ({ message = 'Loading...' }) => {
  return (
    <Box
      className="text-center"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '20px'
      }}
      role="progressbar"
    >
      <CircularProgress />
      <Typography variant="subtitle1" sx={{ mt: 2 }}>
        {message}
      </Typography>
    </Box>
  )
}

Loading.propTypes = {
  message: PropTypes.string
}

export default Loading
