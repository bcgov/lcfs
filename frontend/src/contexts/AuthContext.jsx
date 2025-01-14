import React, { createContext, useContext, useState, useMemo } from 'react'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [forbidden, setForbidden] = useState(false)

  const value = useMemo(
    () => ({
      forbidden,
      setForbidden
    }),
    [forbidden]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
