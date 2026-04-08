import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useRef,
  ReactNode
} from 'react'

interface AuthorizationContextValue {
  forbidden: boolean
  setForbidden: React.Dispatch<React.SetStateAction<boolean>>
  errorRefs: string[]
  addErrorRef: (ref: string) => void
  clearErrorRefs: () => void
  resetServerError: () => void
  errorStatus: number | null
  setErrorStatus: (status: number | null) => void
  serverErrorBlockedRef: React.MutableRefObject<boolean>
}

const AuthorizationContext = createContext<AuthorizationContextValue | null>(null)

interface AuthorizationProviderProps {
  children: ReactNode
}

export const AuthorizationProvider = ({ children }: AuthorizationProviderProps) => {
  const [forbidden, setForbidden] = useState(false)
  const [errorRefs, setErrorRefs] = useState<string[]>([])
  const [errorStatus, setErrorStatusState] = useState<number | null>(null)
  const serverErrorBlockedRef = useRef(false)

  const addErrorRef = (ref: string) => {
    if (ref) setErrorRefs((prev) => (prev.includes(ref) ? prev : [...prev, ref]))
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

export const useAuthorization = (): AuthorizationContextValue => {
  const context = useContext(AuthorizationContext)
  if (!context) {
    throw new Error('useAuthorization must be used within an AuthorizationProvider')
  }
  return {
    forbidden: context.forbidden ?? false,
    setForbidden: context.setForbidden ?? (() => {}),
    errorRefs: context.errorRefs ?? [],
    addErrorRef: context.addErrorRef ?? (() => {}),
    clearErrorRefs: context.clearErrorRefs ?? (() => {}),
    resetServerError: context.resetServerError ?? (() => {}),
    errorStatus: context.errorStatus ?? null,
    setErrorStatus: context.setErrorStatus ?? (() => {}),
    serverErrorBlockedRef: context.serverErrorBlockedRef ?? { current: false }
  }
}
