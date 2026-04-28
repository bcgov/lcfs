import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { useKeycloak } from '@react-keycloak/web'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { CONFIG } from '@/constants/config'
import { FORM_COMPONENTS } from './registry'

export default function FormView() {
  const { formSlug, linkKey } = useParams()
  const { keycloak } = useKeycloak()
  const isAnonymous = Boolean(linkKey)

  const [formMeta, setFormMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const url = isAnonymous
          ? `${CONFIG.API_BASE}/forms/${formSlug}/${linkKey}`
          : `${CONFIG.API_BASE}/forms/${formSlug}`
        const config =
          !isAnonymous && keycloak.authenticated
            ? { headers: { Authorization: `Bearer ${keycloak.token}` } }
            : {}
        const { data } = await axios.get(url, config)
        setFormMeta(data)
      } catch (err) {
        setError(err.response?.data?.detail || err.message || 'Failed to load form.')
      } finally {
        setLoading(false)
      }
    }
    if (formSlug) load()
  }, [formSlug, linkKey, keycloak.authenticated, keycloak.token])

  if (loading) return <Loading message="Loading form..." />

  if (error) {
    return (
      <BCBox p={3}>
        <BCTypography variant="h6" color="error">
          {error}
        </BCTypography>
      </BCBox>
    )
  }

  const FormComponent = FORM_COMPONENTS[formSlug]
  if (!FormComponent) {
    return (
      <BCBox p={3}>
        <BCTypography variant="h6" color="error">
          Form &ldquo;{formSlug}&rdquo; is not yet supported.
        </BCTypography>
      </BCBox>
    )
  }

  return (
    <BCBox p={3}>
      <BCTypography variant="h5" color="primary" mb={1}>
        {formMeta?.name}
      </BCTypography>
      {formMeta?.description && (
        <BCTypography variant="body4" color="text" mb={3}>
          {formMeta.description}
        </BCTypography>
      )}
      <FormComponent formMeta={formMeta} formSlug={formSlug} linkKey={linkKey} />
    </BCBox>
  )
}
