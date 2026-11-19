export type CredentialPair = {
  usernameKey: string
  passwordKey: string
}

export type CredentialValues = {
  username: string | undefined
  password: string | undefined
}

export function findCompleteCredentialPair(
  credentialPairs: CredentialPair[],
  readValue: (key: string) => string | undefined
): CredentialValues
