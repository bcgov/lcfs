import React, { createContext, useContext } from 'react'

export interface AuthorizationContextValue {
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

export const AuthorizationContext =
  createContext<AuthorizationContextValue | null>(null)

export const useAuthorization = (): AuthorizationContextValue => {
  const context = useContext(AuthorizationContext)
  if (!context) {
    throw new Error(
      'useAuthorization must be used within an AuthorizationProvider'
    )
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
