export const ORG_TYPE_LABELS = {
  fuel_supplier: 'Supplier',
  aggregator: 'Aggregator',
  fuel_producer: 'Producer',
  exempted_supplier: 'Exempted',
  initiative_agreement_holder: 'IA Holder',
  credit_trader: 'Credit Transfer'
}

const normalizeOrgTypeKey = (orgType) => {
  if (!orgType) return ''
  if (typeof orgType === 'string') {
    return orgType.toLowerCase()
  }
  return (orgType.orgType || orgType.org_type || '').toLowerCase()
}

// Joined label for an organization's full type list (#4565 multi-type orgs)
export const getOrgTypesDisplayLabel = (orgTypes) =>
  (orgTypes || [])
    .map(getOrgTypeDisplayLabel)
    .filter(Boolean)
    .join(', ')

export const getOrgTypeDisplayLabel = (orgType) => {
  const key = normalizeOrgTypeKey(orgType)

  if (!key) {
    return ''
  }

  if (ORG_TYPE_LABELS[key]) {
    return ORG_TYPE_LABELS[key]
  }

  if (typeof orgType === 'string') {
    return orgType.replace(/_/g, ' ')
  }

  return (
    orgType?.description ||
    orgType?.orgType?.replace(/_/g, ' ') ||
    key.replace(/_/g, ' ')
  )
}
