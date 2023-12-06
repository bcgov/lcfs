import { useKeycloak } from '@react-keycloak/web'
import { useQuery } from 'react-query'
import { Navigate } from 'react-router-dom'
import { CURRENT_USER } from '@/constants/routes'
import useApiService from '@/services/useApiService'
import useUserStore from '@/store/useUserStore'
import 'swagger-ui-react/swagger-ui.css'

const fetchCurrentUser = async (apiService) => {
  try {
    const response = await apiService.get(CURRENT_USER)
    console.log('User Response: ', response)
    return response.data
  } catch (error) {
    console.error('Error fetching current user:', error)
    throw error // Re-throwing the error to be caught by react-query's error handling
  }
}

const RequireAuth = ({ children, redirectTo }) => {
  const { keycloak, initialized } = useKeycloak()
  const setUser = useUserStore((state) => state.setUser)
  const apiService = useApiService()

  const { isLoading, isError, error } = useQuery(
    'currentUser',
    () => fetchCurrentUser(apiService),
    {
      enabled: !!keycloak.authenticated,
      onSuccess: (data) => {
        setUser(data)
      },
      onError: (error) => {
        console.error('Query error:', error)
      },
      retry: false
    }
  )

  if (!initialized || isLoading) {
    return (
      <div className="swagger-ui">
        <div className="loading-container">
          <div className="info">
            <div className="loading-container">
              <div className="loading"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    console.error('Query Error:', error)
    return <Navigate to={redirectTo} />
  }

  if (!keycloak.authenticated) {
    console.error('User not authenticated')
    return <Navigate to={redirectTo} />
  }

  return children
}

export default RequireAuth
