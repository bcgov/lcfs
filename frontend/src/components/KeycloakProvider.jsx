import React from 'react'
import { ReactKeycloakProvider } from '@react-keycloak/web'
import Loading from '@/components/Loading'
import { keycloakInitOptions } from '@/utils/keycloak'
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

  const handleOnEvent = async (event) => {
    if (event === 'onAuthSuccess') {
      const hasBeenTracked =
        sessionStorage.getItem('keycloak-logged-in') === 'true'
      if (!hasBeenTracked) {
        await trackLogin()
        sessionStorage.setItem('keycloak-logged-in', 'true')
      }
    }
    if (event === 'onAuthLogout') {
      sessionStorage.removeItem('keycloak-logged-in')
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
