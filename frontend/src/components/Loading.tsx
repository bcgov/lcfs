import BCTypography from '@/components/BCTypography'
import borders from '@/themes/base/borders'
import colors from '@/themes/base/colors'
import CircularProgress from '@mui/material/CircularProgress'
import PropTypes from 'prop-types'

interface LoadingProps {
  message?: string
  fixed?: boolean
}

const Loading = ({ message = 'Loading...', fixed = false }: LoadingProps) => {
  return (
    <div
      className="text-center"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        zIndex: 99999,
        position: fixed ? 'fixed' : 'relative',
        top: fixed ? 0 : undefined,
        left: fixed ? 0 : undefined,
        margin: fixed ? 0 : '10px'
      }}
      data-test="loading"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          border: fixed ? `1px solid ${colors.primary.main}` : undefined,
          borderRadius: fixed ? borders.borderRadius.lg : undefined,
          padding: fixed ? '20px' : undefined,
          background: fixed ? 'white' : undefined
        }}
      >
        <CircularProgress aria-labelledby="loading" />
        <BCTypography variant="subtitle1" sx={{ mt: 2 }} data-test="message">
          {message}
        </BCTypography>
      </div>
    </div>
  )
}

Loading.propTypes = {
  message: PropTypes.string
}

export default Loading
