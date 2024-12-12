import PropTypes from 'prop-types'
import { Card, CardContent, Divider } from '@mui/material'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { useNavigate } from 'react-router-dom'
import EditIcon from '@mui/icons-material/Edit'
import BCButton from '@/components/BCButton'

function BCWidgetCard({
  color = 'nav',
  title = 'Title',
  content,
  style,
  disableHover = false,
  editButtonText = null,
  editButtonRoute = null
}) {
  const navigate = useNavigate()

  const handleButtonClick = () => {
    if (editButtonRoute) {
      navigate(editButtonRoute)
    }
  }

  return (
    <Card
      sx={{
        border: '1px solid #8c8c8c',
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
          justifyContent="space-between"
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
          {editButtonRoute && (
            <BCButton
              variant="outlined"
              size="small"
              color="primay"
              onClick={handleButtonClick}
              startIcon={<EditIcon sx={{ width: '17px', height: '17px' }} />}
              sx={{
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              {editButtonText}
            </BCButton>
          )}
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
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  content: PropTypes.node.isRequired,
  disableHover: PropTypes.bool,
  subHeader: PropTypes.node,
  editButtonText: PropTypes.string,
  editButtonRoute: PropTypes.string
}

export default BCWidgetCard
