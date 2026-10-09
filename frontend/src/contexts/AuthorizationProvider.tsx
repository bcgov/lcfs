import { useState, useMemo, useRef, ReactNode } from 'react'

import { AuthorizationContext } from './authorizationState'

interface AuthorizationProviderProps {
  children: ReactNode
}

export const AuthorizationProvider = ({
  children
}: AuthorizationProviderProps) => {
  const [forbidden, setForbidden] = useState(false)
  const [errorRefs, setErrorRefs] = useState<string[]>([])
  const [errorStatus, setErrorStatusState] = useState<number | null>(null)
  const serverErrorBlockedRef = useRef(false)

  const addErrorRef = (ref: string) => {
    if (ref)
      setErrorRefs((prev) => (prev.includes(ref) ? prev : [...prev, ref]))
  }

  const clearErrorRefs = () => {
    setErrorRefs([])
  }

  const resetServerError = () => {
    setErrorRefs([])
    setErrorStatusState(null)
    serverErrorBlockedRef.current = false
  }

  const setErrorStatus = (status: number | null) => {
    setErrorStatusState(status)
    if (status === 500) serverErrorBlockedRef.current = true
  }

  const value = useMemo(
    () => ({
      forbidden,
      setForbidden,
      errorRefs,
      addErrorRef,
      clearErrorRefs,
      resetServerError,
      errorStatus,
      setErrorStatus,
      serverErrorBlockedRef
    }),
    [forbidden, errorRefs, errorStatus]
  )

  return (
    <AuthorizationContext.Provider value={value}>
      {children}
    </AuthorizationContext.Provider>
  )
}
