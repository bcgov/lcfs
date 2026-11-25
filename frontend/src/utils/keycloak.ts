import Keycloak from 'keycloak-js'
import { CONFIG } from '@/constants/config'

const keycloak = new Keycloak({
  clientId: CONFIG.KEYCLOAK.CLIENT_ID,
  realm: CONFIG.KEYCLOAK.REALM,
  url: CONFIG.KEYCLOAK.AUTH_URL
})

export const getKeycloak = (): Keycloak => {
  return keycloak
}

export const logout = (): void => {
  // Clear all browser storage (filters, cached data, etc.)
  sessionStorage.clear()
  localStorage.clear()

  // Clear React Query cache
  // Import the queryClient dynamically to avoid circular dependencies
  import('@/main')
    .then(({ queryClient }) => {
      queryClient.clear()
    })
    .catch((error) => {
      console.error('Failed to clear query cache:', error)
    })

  if (CONFIG.KEYCLOAK.LOCAL_AUTH) {
    keycloak
      .logout({ redirectUri: CONFIG.KEYCLOAK.POST_LOGOUT_URL })
      .catch((error) => {
        console.error('Failed to log out from local Keycloak:', error)
      })
    return
  }
  keycloak
    .logout({
      redirectUri:
        CONFIG.KEYCLOAK.SM_LOGOUT_URL +
        encodeURIComponent(CONFIG.KEYCLOAK.POST_LOGOUT_URL)
    })
    .catch((error) => {
      console.error('Failed to log out from Keycloak:', error)
    })
}
