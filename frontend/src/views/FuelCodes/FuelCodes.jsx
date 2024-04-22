import BCButton from '@/components/BCButton'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'

export const FuelCodes = () => {
  const navigate = useNavigate()
  return (
    <div>
      Fuel Codes
      <br />
      <BCButton
        variant="contained"
        color="primary"
        onClick={() => navigate(ROUTES.ADMIN_FUELCODES_ADD)}
      >
        Add Fuel Codes
      </BCButton>
    </div>
  )
}
