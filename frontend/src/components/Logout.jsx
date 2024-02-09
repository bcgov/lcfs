import { useKeycloak } from '@react-keycloak/web'
import BCButton from '@/components/BCButton'
import { logout } from '@/utils/keycloak'
import { useCurrentUser } from '@/hooks/useCurrentUser'

const Logout = () => {
  const { keycloak } = useKeycloak()
  const { data: currentUser } = useCurrentUser()
  if (keycloak.authenticated) {
    return (
      <div className="logout">
        <span>{`Logged in as: ${currentUser?.fullName()} |`}</span>
        <BCButton
          data-test="logout-button"
          onClick={() => {
            logout()
          }}
          color="light"
          size="small"
          variant="outlined"
        >
          Log out
        </BCButton>
      </div>
    )
  }
  return null
}

export default Logout
