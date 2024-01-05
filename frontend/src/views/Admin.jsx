import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { faSpaceShuttle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate } from 'react-router-dom'

export const Admin = () => {
  const navigate = useNavigate()
  return (
    <BCButton
      variant="contained"
      size="small"
      color="primary"
      startIcon={
        <FontAwesomeIcon icon={faSpaceShuttle} className="small-icon" />
      }
      onClick={() => navigate('/admin/users')}
    >
      <BCTypography variant="subtitle2">Admin Settings</BCTypography>
    </BCButton>
  )
}
