// Utilities and helpers for Link Key management logic

export const normalizeFormId = (formId) => {
  if (formId == null) return null
  if (typeof formId === 'number') return Number.isFinite(formId) ? formId : null
  const parsed = parseInt(formId, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export const normalizeKeyData = (keyData = {}) => ({
  formId: keyData.form_id ?? keyData.formId ?? keyData.form?.id,
  formSlug: keyData.form_slug ?? keyData.formSlug ?? keyData.slug,
  linkKey: keyData.link_key ?? keyData.linkKey ?? keyData.key,
  createDate: keyData.create_date ?? keyData.createDate ?? keyData.created_at
})

export const generateFormLink = (
  formSlug,
  linkKey,
  baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
) => {
  return `${baseUrl}/forms/${formSlug}/${linkKey}`
}

export const hasExistingKey = (
  normalizedLinkKeys = [],
  linkKeyCache = {},
  formId
) => {
  if (!formId) return false
  const normalizedId = normalizeFormId(formId)
  const cached = linkKeyCache[normalizedId]
  if (cached?.linkKey) return true
  return normalizedLinkKeys.some(
    (key) => normalizeFormId(key.formId) === normalizedId && key.linkKey
  )
}

export const getExistingKey = (
  normalizedLinkKeys = [],
  linkKeyCache = {},
  formId
) => {
  if (!formId) return null
  const normalizedId = normalizeFormId(formId)
  const cached = linkKeyCache[normalizedId]
  if (cached?.linkKey) return cached
  return normalizedLinkKeys.find(
    (key) => normalizeFormId(key.formId) === normalizedId && key.linkKey
  )
}

export const buildCacheFromLinkKeys = (normalizedLinkKeys = []) => {
  const cache = {}
  normalizedLinkKeys.forEach((key) => {
    if (key.formId && key.linkKey) {
      const normalizedId = normalizeFormId(key.formId)
      cache[normalizedId] = {
        formSlug: key.formSlug,
        linkKey: key.linkKey,
        createDate: key.createDate
      }
    }
  })
  return cache
}

export const updateCacheEntry = (cache = {}, formId, keyData) => {
  const normalizedId = normalizeFormId(formId)
  if (!normalizedId) return cache
  return {
    ...cache,
    [normalizedId]: keyData
  }
}

export const removeCacheEntry = (cache = {}, formId) => {
  const normalizedId = normalizeFormId(formId)
  if (!normalizedId) return cache
  const updated = { ...cache }
  delete updated[normalizedId]
  return updated
}
