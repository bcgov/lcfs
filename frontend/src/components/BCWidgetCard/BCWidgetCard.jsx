import PropTypes from 'prop-types'

// @mui material components
import { Card, CardContent, Divider } from '@mui/material'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'

function BCWidgetCard({ color, title, content, style, disableHover }) {
  return (
    <Card
      sx={{
        border: '1px solid #8c8c8c',
        '&:hover': {
          transform: disableHover ? 'none' : 'scale(1.005)'
        },
        mb: 5,
        ...style
      }}
    >
      <BCBox display="flex" justifyContent="center" pt={1} py={1.5}>
        <BCBox
          variant="contained"
          bgColor={color}
          color={color === 'light' ? 'dark' : 'white'}
          coloredShadow={color}
          borderRadius="md"
          display="flex"
          justifyContent="left"
          alignItems="center"
          px={2}
          py={1}
          width="100%"
          mx={2}
          mt={-3}
        >
          <BCTypography variant="subtitle2" fontWeight="light" color="inherit">
            {title}
          </BCTypography>
        </BCBox>
      </BCBox>
      <Divider
        aria-hidden="true"
        light={false}
        sx={{ borderBottom: '1px solid #c0c0c0' }}
      />
      <CardContent>{content}</CardContent>
    </Card>
  )
}

// Setting default values for the props of BCWidgetCard
BCWidgetCard.defaultProps = {
  color: 'nav',
  disableHover: false
}

// Typechecking props for the BCWidgetCard
BCWidgetCard.propTypes = {
  color: PropTypes.oneOf([
    'primary',
    'secondary',
    'info',
    'success',
    'warning',
    'error',
    'light',
    'nav',
    'dark'
  ]),
  title: PropTypes.string.isRequired,
  content: PropTypes.node.isRequired,
  disableHover: PropTypes.bool,
  subHeader: PropTypes.node
}

export default BCWidgetCard
