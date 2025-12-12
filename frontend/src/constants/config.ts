export interface FeatureFlagsConfig {
  supplementalReporting?: boolean
  fullLegacyReports?: boolean
  fseImportExport?: boolean
  allocationAgreementImportExport?: boolean
  governmentAdjustment?: boolean
  roleSwitcher?: boolean
  obfuscatedLinks?: boolean
  reporting2025Enabled?: boolean
  manageChargingSites?: boolean
  manageFse?: boolean
  legacySupplementalLock?: boolean
}

export interface KeycloakConfig {
  REALM?: string
  CLIENT_ID?: string
  AUTH_URL?: string
  POST_LOGOUT_URL?: string
  SM_LOGOUT_URL?: string
}

export interface LcfsWindowConfig {
  api_base?: string
  tfrs_base: string
  environment: string
  keycloak: KeycloakConfig
  feature_flags: FeatureFlagsConfig
}

declare global {
  interface Window {
    lcfs_config: LcfsWindowConfig
  }
}

const rawEnvironment = window.lcfs_config.environment ?? ''
const normalizedEnvironment =
  typeof rawEnvironment === 'string' ? rawEnvironment.toLowerCase() : ''
const isProductionEnvironment = ['production', 'prod'].includes(
  normalizedEnvironment
)

export function getApiBaseUrl(): string {
  const hostnameParts = window.location.hostname.split('.')

  let baseUrl
  if (window.location.hostname === 'localhost') {
    baseUrl = `${window.location.protocol}//localhost:8000/api`
  } else {
    const subDomain = hostnameParts[0]
    const envPart = subDomain.split('-')[1]

    if (envPart === 'dev' || envPart === 'test') {
      baseUrl = `${
        window.location.protocol
      }//lcfs-backend-${envPart}.${hostnameParts.slice(1).join('.')}/api`
    } else {
      baseUrl = `${window.location.protocol}//lcfs-backend.${hostnameParts
        .slice(1)
        .join('.')}/api`
    }
  }

  return window.lcfs_config.api_base ?? baseUrl
}

export const FEATURE_FLAGS = {
  SUPPLEMENTAL_REPORTING: 'supplementalReporting',
  LEGACY_REPORT_DETAILS: 'fullLegacyReports',
  FSE_IMPORT_EXPORT: 'fseImportExport',
  ALLOCATION_AGREEMENT_IMPORT_EXPORT: 'allocationAgreementImportExport',
  GOVERNMENT_ADJUSTMENT: 'governmentAdjustment',
  ROLE_SWITCHER: 'roleSwitcher',
  OBFUSCATED_LINKS: 'obfuscatedLinks',
  REPORTING_2025_ENABLED: 'reporting2025Enabled',
  MANAGE_CHARGING_SITES: 'manageChargingSites',
  MANAGE_FSE: 'manageFse',
  LEGACY_SUPPLEMENTAL_LOCK: 'legacySupplementalLock'
} as const

export type FeatureFlagValue =
  (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS]

export const isFeatureEnabled = (featureFlag: FeatureFlagValue): boolean => {
  return CONFIG.feature_flags[featureFlag]
}

export interface AppConfig {
  API_BASE: string
  TFRS_BASE: string
  ENVIRONMENT: string
  KEYCLOAK: Required<KeycloakConfig>
  feature_flags: Record<FeatureFlagValue, boolean>
}

const getKeycloakConfig = (
  config: KeycloakConfig
): Required<KeycloakConfig> => ({
  REALM: config.REALM ?? 'standard',
  CLIENT_ID: config.CLIENT_ID ?? 'low-carbon-fuel-standard-5147',
  AUTH_URL: config.AUTH_URL ?? 'https://dev.loginproxy.gov.bc.ca/auth',
  POST_LOGOUT_URL: config.POST_LOGOUT_URL ?? 'http://localhost:3000/',
  SM_LOGOUT_URL:
    config.SM_LOGOUT_URL ??
    'https://logontest7.gov.bc.ca/clp-cgi/logoff.cgi?retnow=1&returl='
})

export const CONFIG: AppConfig = {
  API_BASE: getApiBaseUrl(),
  TFRS_BASE: window.lcfs_config.tfrs_base,
  ENVIRONMENT: window.lcfs_config.environment,
  KEYCLOAK: getKeycloakConfig(window.lcfs_config.keycloak),
  feature_flags: {
    supplementalReporting:
      window.lcfs_config.feature_flags.supplementalReporting ?? false,
    fullLegacyReports:
      window.lcfs_config.feature_flags.fullLegacyReports ?? false,
    fseImportExport: window.lcfs_config.feature_flags.fseImportExport ?? false,
    allocationAgreementImportExport:
      window.lcfs_config.feature_flags.allocationAgreementImportExport ?? false,
    governmentAdjustment:
      window.lcfs_config.feature_flags.governmentAdjustment ?? false,
    roleSwitcher: window.lcfs_config.feature_flags.roleSwitcher ?? false,
    obfuscatedLinks: window.lcfs_config.feature_flags.obfuscatedLinks ?? false,
    reporting2025Enabled:
      window.lcfs_config.feature_flags.reporting2025Enabled ?? false,
    manageChargingSites:
      window.lcfs_config.feature_flags.manageChargingSites ??
      !isProductionEnvironment,
    manageFse:
      window.lcfs_config.feature_flags.manageFse ?? !isProductionEnvironment,
    legacySupplementalLock:
      window.lcfs_config.feature_flags.legacySupplementalLock ?? false
  }
}
