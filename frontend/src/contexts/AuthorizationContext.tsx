import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  ReactNode
} from 'react'

interface AuthorizationContextValue {
  forbidden: boolean
  setForbidden: React.Dispatch<React.SetStateAction<boolean>>
}

const AuthorizationContext = createContext<AuthorizationContextValue | null>(null)

interface AuthorizationProviderProps {
  children: ReactNode
}

export const AuthorizationProvider = ({ children }: AuthorizationProviderProps) => {
  const [forbidden, setForbidden] = useState(false)

  const value = useMemo(
    () => ({
      forbidden,
      setForbidden
    }),
    [forbidden]
  )

  return (
    <AuthorizationContext.Provider value={value}>
      {children}
    </AuthorizationContext.Provider>
  )
}

export const useAuthorization = (): AuthorizationContextValue => {
  const context = useContext(AuthorizationContext)
  if (!context) {
    throw new Error('useAuthorization must be used within an AuthorizationProvider')
  }
  return context
}
