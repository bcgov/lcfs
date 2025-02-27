import React, { useEffect } from 'react'
import { ReactKeycloakProvider } from '@react-keycloak/web'
import Loading from '@/components/Loading'
import { keycloakInitOptions, initializeTokenRefresh } from '@/utils/keycloak'
import { apiRoutes } from '@/constants/routes'
import axios from 'axios'
import { CONFIG } from '@/constants/config'

export const KeycloakProvider = ({ authClient, children }) => {
  // Cannot use API Service before Keycloak is initialized
  const trackLogin = async () => {
    await axios.post(
      `${CONFIG.API_BASE}${apiRoutes.trackUserLogin}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${authClient.token}`
        }
      }
    )
  }

  useEffect(() => {
    let cleanup = () => {}

    // We'll set up token refresh and activity monitoring after authentication
    if (authClient.authenticated) {
      cleanup = initializeTokenRefresh()
    }

    return () => {
      cleanup()
    }
  }, [authClient.authenticated])

  const handleOnEvent = async (event) => {
    if (event === 'onAuthSuccess') {
      // Initialize the token refresh mechanism when auth is successful
      const cleanup = initializeTokenRefresh()

      // Track login if not already tracked
      const hasBeenTracked =
        localStorage.getItem('keycloak-logged-in') === 'true'
      if (!hasBeenTracked) {
        await trackLogin()
        localStorage.setItem('keycloak-logged-in', 'true')
      }

      return () => cleanup()
    }
    if (event === 'onAuthLogout') {
      localStorage.removeItem('keycloak-logged-in')
    }
  }

  return (
    <ReactKeycloakProvider
      authClient={authClient}
      initOptions={keycloakInitOptions}
      LoadingComponent={<Loading />}
      onEvent={handleOnEvent}
    >
      {children}
    </ReactKeycloakProvider>
  )
}
