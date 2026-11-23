import { useKeycloak } from '@react-keycloak/web'
import BCButton from '@/components/BCButton'
import { logout } from '@/utils/keycloak'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export const Logout = () => {
  const { keycloak } = useKeycloak()
  const { fullName } = useCurrentUser()
  if (keycloak.authenticated) {
    return (
      <div className="logout" data-test="logout">
        <span>{`Logged in as: ${fullName()} |`}</span>
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
