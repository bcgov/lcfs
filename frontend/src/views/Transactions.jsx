import { useNavigate } from 'react-router-dom'
import { Stack } from '@mui/material'

// Font Awesome
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

// Hooks
import { useCurrentUser } from '@/hooks/useCurrentUser'

// Constants
import { ROUTES } from '@/constants/routes'
import { roles } from '@/constants/roles'

// Components
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'

export const Transactions = () => {
  const navigate = useNavigate()
  const { hasRoles } = useCurrentUser();

  return <>
    <BCTypography variant="h5">Transactions</BCTypography>
    <Stack
        direction={{ md: 'coloumn', lg: 'row' }}
        spacing={{ xs: 2, sm: 2, md: 3 }}
        useFlexGap
        flexWrap="wrap"
        m={2}
      >
      {hasRoles(roles.transfers) && (
          <BCButton
          variant="contained"
          size="small"
          color="primary"
          startIcon={
            <FontAwesomeIcon icon={faCirclePlus} className="small-icon" />
          }
          onClick={() => navigate(ROUTES.TRANSACTIONS_ADD)}
        >
          <BCTypography variant="subtitle2">New Transfer</BCTypography>
        </BCButton>
      )}
      </Stack>
  </>
}
