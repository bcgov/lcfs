import { createContext } from 'react'

export interface KeycloakContextValue {
  refreshToken: (force?: boolean) => Promise<void>
  keycloak: {
    authenticated?: boolean
    token?: string
  }
}

export const KeycloakContext = createContext<KeycloakContextValue | null>(null)
