// Utilities and helpers for Link Key management logic

export type NormalizedLinkKey = {
  formId?: string | number | null
  formSlug?: string | null
  linkKey?: string | null
  createDate?: string | null
}
export type LinkKeyData = {
  formSlug?: string | null
  linkKey?: string | null
  createDate?: string | null
}
export type LinkKeyCache = Record<number, LinkKeyData>
export type LinkKeyApiData = {
  form_id?: string | number | null
  formId?: string | number | null
  form?: { id?: string | number | null } | null
  form_slug?: string | null
  formSlug?: string | null
  slug?: string | null
  link_key?: string | null
  linkKey?: string | null
  key?: string | null
  create_date?: string | null
  createDate?: string | null
  created_at?: string | null
}

export const normalizeFormId = (
  formId: string | number | null | undefined
): number | null => {
  if (formId == null) return null
  if (typeof formId === 'number') return Number.isFinite(formId) ? formId : null
  const parsed = parseInt(formId, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export const normalizeKeyData = (
  keyData: LinkKeyApiData = {}
): NormalizedLinkKey => ({
  formId: keyData.form_id ?? keyData.formId ?? keyData.form?.id,
  formSlug: keyData.form_slug ?? keyData.formSlug ?? keyData.slug,
  linkKey: keyData.link_key ?? keyData.linkKey ?? keyData.key,
  createDate: keyData.create_date ?? keyData.createDate ?? keyData.created_at
})

export const generateFormLink = (
  formSlug: string,
  linkKey: string,
  baseUrl: string = typeof window !== 'undefined' ? window.location.origin : ''
) => {
  return `${baseUrl}/forms/${formSlug}/${linkKey}`
}

export const hasExistingKey = (
  normalizedLinkKeys: NormalizedLinkKey[] = [],
  linkKeyCache: LinkKeyCache = {},
  formId: string | number | null | undefined
) => {
  if (!formId) return false
  const normalizedId = normalizeFormId(formId)
  const cached = normalizedId === null ? undefined : linkKeyCache[normalizedId]
  if (cached?.linkKey) return true
  return normalizedLinkKeys.some(
    (key) => normalizeFormId(key.formId) === normalizedId && key.linkKey
  )
}

export const getExistingKey = (
  normalizedLinkKeys: NormalizedLinkKey[] = [],
  linkKeyCache: LinkKeyCache = {},
  formId: string | number | null | undefined
) => {
  if (!formId) return null
  const normalizedId = normalizeFormId(formId)
  const cached = normalizedId === null ? undefined : linkKeyCache[normalizedId]
  if (cached?.linkKey) return cached
  return normalizedLinkKeys.find(
    (key) => normalizeFormId(key.formId) === normalizedId && key.linkKey
  )
}

export const buildCacheFromLinkKeys = (
  normalizedLinkKeys: NormalizedLinkKey[] = []
): LinkKeyCache => {
  const cache: LinkKeyCache = {}
  normalizedLinkKeys.forEach((key) => {
    if (key.formId && key.linkKey) {
      const normalizedId = normalizeFormId(key.formId)
      if (normalizedId === null) return
      cache[normalizedId] = {
        formSlug: key.formSlug,
        linkKey: key.linkKey,
        createDate: key.createDate
      }
    }
  })
  return cache
}

export const updateCacheEntry = (
  cache: LinkKeyCache = {},
  formId: string | number | null | undefined,
  keyData: LinkKeyData
): LinkKeyCache => {
  const normalizedId = normalizeFormId(formId)
  if (!normalizedId) return cache
  return {
    ...cache,
    [normalizedId]: keyData
  }
}

export const removeCacheEntry = (
  cache: LinkKeyCache = {},
  formId: string | number | null | undefined
): LinkKeyCache => {
  const normalizedId = normalizeFormId(formId)
  if (!normalizedId) return cache
  const updated = { ...cache }
  delete updated[normalizedId]
  return updated
}
