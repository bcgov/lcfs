import { useAuth } from '@/hooks/useAuth'
import BCButton from '@/components/BCButton'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export const Logout = () => {
  const auth = useAuth()
  const { fullName } = useCurrentUser()
  if (auth.isAuthenticated) {
    return (
      <div className="logout" data-test="logout">
        <span>{`Logged in as: ${auth.user?.profile?.name || fullName() || 'User'} |`}</span>
        <BCButton
          data-test="logout-button"
          onClick={() => {
            auth.signoutRedirect()
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
