export const IDENTITY_PROVIDERS = {
  BCEID_BUSINESS: 'bceidbusiness',
  IDIR: 'idir'
} as const

export type IdentityProvider =
  (typeof IDENTITY_PROVIDERS)[keyof typeof IDENTITY_PROVIDERS]
