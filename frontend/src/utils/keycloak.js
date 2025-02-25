import Keycloak from 'keycloak-js'
import { CONFIG } from '@/constants/config'

const keycloak = new Keycloak({
  clientId: CONFIG.KEYCLOAK.CLIENT_ID,
  realm: CONFIG.KEYCLOAK.REALM,
  url: CONFIG.KEYCLOAK.AUTH_URL
})

export const keycloakInitOptions = {
  onLoad: 'check-sso',
  pkceMethod: 'S256'
}

export const getKeycloak = () => {
  return keycloak
}

// Timers to track user activity and token refresh state
let inactivityTimer
const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 minutes
let isRefreshScheduled = false
const minValidity = 60 // Minimum validity in seconds before refresh

export const logout = () => {
  localStorage.removeItem('keycloak-logged-in')
  clearTimeout(inactivityTimer) // Clear the inactivity timer on logout

  const idToken = keycloak.idToken || keycloak.tokenParsed?.idToken
  if (!idToken) {
    console.error('idToken is not available')
    return
  }
  const keycloakLogoutUrl =
    keycloak.endpoints.logout() +
    '?post_logout_redirect_uri=' +
    CONFIG.KEYCLOAK.POST_LOGOUT_URL +
    '&client_id=' +
    keycloak.clientId +
    '&id_token_hint=' +
    idToken

  const url =
    CONFIG.KEYCLOAK.SM_LOGOUT_URL + encodeURIComponent(keycloakLogoutUrl)

  window.location = url
}

// reset the inactivity timer
export const resetInactivityTimer = () => {
  clearTimeout(inactivityTimer)
  inactivityTimer = setTimeout(() => {
    console.log('User inactive for 5 minutes, logging out')
    logout()
  }, INACTIVITY_TIMEOUT)
}

// schedule the next token refresh
const scheduleNextRefresh = (expiryTime) => {
  if (isRefreshScheduled) return

  // Calculate time until refresh (subtract buffer time to ensure refresh happens before expiry)
  const currentTime = Math.floor(Date.now() / 1000)
  const timeUntilRefresh = Math.max(1, expiryTime - currentTime - minValidity)

  isRefreshScheduled = true
  setTimeout(() => {
    refreshToken()
    isRefreshScheduled = false
  }, timeUntilRefresh * 1000)

  console.log(`Next token refresh scheduled in ${timeUntilRefresh} seconds`)
}

// token refresh
export const refreshToken = () => {
  // If the user is already logged out or refreshing is in progress, don't proceed
  if (!keycloak.authenticated) return

  keycloak
    .updateToken(minValidity) // Minimum validity in seconds
    .then((refreshed) => {
      if (refreshed) {
        console.log('Token refreshed')
        // After successful refresh, schedule the next refresh
        if (keycloak.tokenParsed?.exp) {
          scheduleNextRefresh(keycloak.tokenParsed.exp)
        }
      } else {
        console.log('Token still valid, no refresh needed')
        // If the token wasn't refreshed (because it's still valid),
        // still schedule the next refresh based on the current token's expiry
        if (keycloak.tokenParsed?.exp) {
          scheduleNextRefresh(keycloak.tokenParsed.exp)
        }
      }

      // Reset inactivity timer on successful token operations
      resetInactivityTimer()
    })
    .catch((error) => {
      console.error('Failed to refresh token', error)
      logout()
    })
}

// register user activity events
export const registerActivityEvents = () => {
  const activityEvents = [
    'mousedown',
    'keydown',
    'touchstart',
    'scroll',
    'mousemove'
  ]

  // Add throttling to avoid excessive refreshes
  let lastActivity = Date.now()
  const THROTTLE_DELAY = 60000 // 1 minute between activity checks

  const handleUserActivity = () => {
    const now = Date.now()
    if (now - lastActivity > THROTTLE_DELAY) {
      lastActivity = now
      resetInactivityTimer()

      // Only attempt to refresh if we're close to expiration
      if (keycloak.authenticated && keycloak.tokenParsed?.exp) {
        const currentTime = Math.floor(Date.now() / 1000)
        const timeUntilExpiry = keycloak.tokenParsed.exp - currentTime

        // If token will expire in less than 2x our minValidity, try refreshing
        if (timeUntilExpiry < minValidity * 2 && !isRefreshScheduled) {
          refreshToken()
        }
      }
    }
  }

  // Register the activity event listeners
  activityEvents.forEach((event) => {
    window.addEventListener(event, handleUserActivity, { passive: true })
  })

  // Initialize the inactivity timer
  resetInactivityTimer()

  // Return a cleanup function to remove the event listeners
  return () => {
    activityEvents.forEach((event) => {
      window.removeEventListener(event, handleUserActivity)
    })
    clearTimeout(inactivityTimer)
  }
}

// Initialize token refresh on successful authentication
export const initializeTokenRefresh = () => {
  if (keycloak.authenticated && keycloak.tokenParsed?.exp) {
    // Schedule the initial token refresh
    scheduleNextRefresh(keycloak.tokenParsed.exp)

    // Register activity monitoring
    return registerActivityEvents()
  }
  return () => {}
}
