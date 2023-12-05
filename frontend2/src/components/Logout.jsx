import useUserStore from '@/store/useUserStore'
import { useKeycloak } from '@react-keycloak/web'
import BCButton from '@/components/BCButton'
import { logout } from '@/keycloak'

const Logout = () => {
  const { keycloak } = useKeycloak()
  const user = useUserStore((state) => state.user)
  if (keycloak.authenticated) {
    return (
      <div className="logout">
        <span>{`Logged in as: ${user?.display_name} |`}</span>
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
