export function getApiBaseUrl() {
  // Split the hostname
  const hostnameParts = window.location.hostname.split('.')

  // Check if the environment is local development
  let baseUrl
  if (window.location.hostname === 'localhost') {
    // In local development, use port 8000
    baseUrl = `${window.location.protocol}//localhost:8000/api`
  } else {
    // Determine the environment part of the subdomain
    const subDomain = hostnameParts[0]
    const envPart = subDomain.split('-')[1]

    // Check if the environment is 'dev' or 'test', otherwise default to production
    if (envPart === 'dev' || envPart === 'test') {
      baseUrl = `${
        window.location.protocol
      }//lcfs-backend-${envPart}.${hostnameParts.slice(1).join('.')}/api`
    } else {
      // Production environment
      baseUrl = `${window.location.protocol}//lcfs-backend.${hostnameParts
        .slice(1)
        .join('.')}/api`
    }
  }
  // Use getConfig to get 'api_base' from configuration or fallback to baseUrl
  return window.lcfs_config.api_base ?? baseUrl
}

export const isFeatureEnabled = (featureFlag) => {
  return CONFIG.feature_flags[featureFlag]
}

export const FEATURE_FLAGS = {
  SUPPLEMENTAL_REPORTING: 'supplementalReporting',
  LEGACY_REPORT_DETAILS: 'fullLegacyReports',
  FSE_IMPORT_EXPORT: 'fseImportExport',
  ALLOCATION_AGREEMENT_IMPORT_EXPORT: 'allocationAgreementImportExport',
  GOVERNMENT_ADJUSTMENT: 'governmentAdjustment',
  OBFUSCATED_LINKS: 'obfuscatedLinks',
  REPORTING_2025_ENABLED: 'reporting2025Enabled'
}

export const CONFIG = {
  API_BASE: getApiBaseUrl(),
  TFRS_BASE: window.lcfs_config.tfrs_base,
  ENVIRONMENT: window.lcfs_config.environment,
  KEYCLOAK: {
    REALM: window.lcfs_config.keycloak.REALM ?? 'standard',
    CLIENT_ID:
      window.lcfs_config.keycloak.CLIENT_ID ?? 'low-carbon-fuel-standard-5147',
    AUTH_URL:
      window.lcfs_config.keycloak.AUTH_URL ??
      'https://dev.loginproxy.gov.bc.ca/auth',
    POST_LOGOUT_URL:
      window.lcfs_config.keycloak.POST_LOGOUT_URL ?? 'http://localhost:3000/',
    SM_LOGOUT_URL:
      window.lcfs_config.keycloak.SM_LOGOUT_URL ??
      'https://logontest7.gov.bc.ca/clp-cgi/logoff.cgi?retnow=1&returl='
  },
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
    obfuscatedLinks: window.lcfs_config.feature_flags.obfuscatedLinks ?? false,
    reporting2025Enabled: window.lcfs_config.feature_flags.reporting2025Enabled ?? false
  }
}
