import PropTypes from 'prop-types'
import { Card, CardContent, Divider } from '@mui/material'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { useNavigate } from 'react-router-dom'
import { Edit } from '@mui/icons-material'
import BCButton from '@/components/BCButton'

function BCWidgetCard({
  color = 'nav',
  title = 'Title',
  content,
  style,
  editButton
}) {
  const navigate = useNavigate()

  const handleButtonClick = () => {
    if (editButton?.route) {
      navigate(editButton.route)
    }
    if (editButton?.onClick) {
      editButton.onClick()
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
          <BCTypography
            variant="subtitle2"
            fontWeight="light"
            color="inherit"
            component="h2"
          >
            {title}
          </BCTypography>
          {editButton && (
            <BCButton
              id={editButton.id}
              variant="outlined"
              size="small"
              style={{ maxHeight: '25px', minHeight: '25px' }}
              color="light"
              onClick={handleButtonClick}
              startIcon={<Edit sx={{ width: '16px', height: '16px' }} />}
              sx={{
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  color: 'rgba(0, 0, 0, 0.8)',
                  borderColor: 'rgba(0, 0, 0, 0.8)'
                }
              }}
            >
              {editButton.text}
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
  subHeader: PropTypes.node,
  editButton: PropTypes.oneOf([PropTypes.object, PropTypes.bool])
}

export default BCWidgetCard
