import { KeycloakContext } from '@/components/KeycloakProvider'
import { useContext } from 'react'

export const useAuth = () => {
  const context = useContext(KeycloakContext)
  if (!context) {
    throw new Error('useKeycloak must be used within an AuthProvider')
  }
  return context
}
