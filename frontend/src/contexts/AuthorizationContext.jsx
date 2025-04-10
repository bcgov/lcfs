import React, { createContext, useContext, useState, useMemo } from 'react'

const AuthorizationContext = createContext(null)

export const AuthorizationProvider = ({ children }) => {
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

export const useAuthorization = () => useContext(AuthorizationContext)
