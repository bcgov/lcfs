import Loading from '@/components/Loading'
import { CONFIG } from '@/constants/config'
import { apiRoutes } from '@/constants/routes'
import { getKeycloak, logout } from '@/utils/keycloak'
import { ReactKeycloakProvider } from '@react-keycloak/web'
import axios from 'axios'
import React, { useContext, useEffect, useRef } from 'react'

const keycloak = getKeycloak()

export const KeycloakContext = React.createContext()

// const MIN_VALIDITY = 60
const TOKEN_LIFESPAN_MS = 5 * 60 * 1000
const REFRESH_THRESHOLD_MS = 60 * 1000

export const KeycloakProvider = ({ children }) => {
  const timeoutRef = useRef(null)
  const refreshTokenRef = useRef(null)
  const lastRefreshRef = useRef(Date.now())

  const scheduleRefreshCheck = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    const now = Date.now()
    const timeSinceLastRefresh = now - lastRefreshRef.current
    const timeToNextRefresh = TOKEN_LIFESPAN_MS - timeSinceLastRefresh

    if (timeToNextRefresh > REFRESH_THRESHOLD_MS) {
      const delay = timeToNextRefresh - REFRESH_THRESHOLD_MS
      timeoutRef.current = setTimeout(() => {
        if (refreshTokenRef.current) {
          refreshTokenRef.current(true)
        }
      }, delay)
    }
  }

  const refreshToken = async (force = false) => {
    if (!keycloak.authenticated) return

    const now = Date.now()
    const timeSinceLastRefresh = now - lastRefreshRef.current
    const timeToNextRefresh = TOKEN_LIFESPAN_MS - timeSinceLastRefresh

    if (!force && timeToNextRefresh > REFRESH_THRESHOLD_MS) {
      return
    }

    try {
      await keycloak.updateToken(5)
      lastRefreshRef.current = Date.now()

      scheduleRefreshCheck()
    } catch (error) {
      console.error('Failed to refresh token', error)
      logout()
    }
  }

  refreshTokenRef.current = refreshToken

  useEffect(() => {
    scheduleRefreshCheck()
    return () => timeoutRef.current && clearTimeout(timeoutRef.current)
  }, [])

  useEffect(() => {
    const events = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'wheel',
      'touchstart'
    ]

    events.forEach((event) =>
      window.addEventListener(event, () => refreshToken())
    )

    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, () => refreshToken())
      )
    }
  }, [])

  // Cannot use API Service before Keycloak is initialized
  const trackLogin = async () => {
    await axios.post(
      `${CONFIG.API_BASE}${apiRoutes.trackUserLogin}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${keycloak.token}`
        }
      }
    )
  }

  const handleOnEvent = async (event) => {
    if (event === 'onAuthSuccess') {
      scheduleRefreshCheck()

      const hasBeenTracked =
        localStorage.getItem('keycloak-logged-in') === 'true'
      if (!hasBeenTracked) {
        await trackLogin()
        localStorage.setItem('keycloak-logged-in', 'true')
      }
    }
    if (event === 'onAuthLogout') {
      localStorage.removeItem('keycloak-logged-in')
    }
  }

  return (
    <KeycloakContext.Provider
      value={{
        refreshToken,
        keycloak
      }}
    >
      <ReactKeycloakProvider
        authClient={keycloak}
        initOptions={{
          onLoad: 'check-sso',
          pkceMethod: 'S256'
        }}
        LoadingComponent={<Loading />}
        onEvent={handleOnEvent}
      >
        {children}
      </ReactKeycloakProvider>
    </KeycloakContext.Provider>
  )
}
