export const findCompleteCredentialPair = (credentialPairs, readValue) => {
  for (const { usernameKey, passwordKey } of credentialPairs) {
    const username = readValue(usernameKey)
    const password = readValue(passwordKey)
    if (
      typeof username === 'string' &&
      username.length > 0 &&
      typeof password === 'string' &&
      password.length > 0
    ) {
      return { username, password }
    }
  }

  return { username: undefined, password: undefined }
}
