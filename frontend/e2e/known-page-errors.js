// Both runners ignore only these existing application cleanup/network races.
export const isKnownTransientException = (error) => {
  const message = error?.message || ''
  const stack = error?.stack || ''
  const isTrackLoginError =
    (message.includes('Network Error') ||
      message.includes('NetworkError when attempting to fetch resource')) &&
    stack.includes('KeycloakProvider.jsx')
  const isKeycloakLoginStatusError =
    message.includes('NetworkError when attempting to fetch resource') &&
    stack.includes('login-status-iframe.html')
  const isGridTransactionRace =
    message.includes(
      "Cannot read properties of undefined (reading 'applyTransaction')"
    ) && stack.includes('BCGridEditor.jsx')
  return (
    isTrackLoginError || isKeycloakLoginStatusError || isGridTransactionRace
  )
}
