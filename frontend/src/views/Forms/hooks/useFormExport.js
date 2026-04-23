import { useCallback, useState } from 'react'
import axios from 'axios'
import { useKeycloak } from '@react-keycloak/web'
import { useSnackbar } from 'notistack'
import { CONFIG } from '@/constants/config'

/**
 * Posts form data to the export endpoint and triggers a file download.
 * Handles both authenticated and anonymous (link-key) access automatically.
 */
export function useFormExport({ formSlug, linkKey, organizationName }) {
  const { keycloak } = useKeycloak()
  const { enqueueSnackbar } = useSnackbar()
  const [downloading, setDownloading] = useState(null) // 'pdf' | 'docx' | null
  const [downloadSuccess, setDownloadSuccess] = useState(false)

  const { authenticated, token } = keycloak

  const exportForm = useCallback(
    async (values, format = 'docx') => {
      setDownloading(format)
      setDownloadSuccess(false)

      try {
        const isAnon = Boolean(linkKey)
        const base = isAnon
          ? `${CONFIG.API_BASE}/forms/${formSlug}/${linkKey}/export`
          : `${CONFIG.API_BASE}/forms/${formSlug}/export`

        const headers = { 'Content-Type': 'application/json' }
        if (!isAnon && authenticated) {
          headers.Authorization = `Bearer ${token}`
        }

        const response = await axios.post(
          `${base}?format=${format}`,
          { ...values, organization_name: organizationName || '' },
          { headers, responseType: 'blob' }
        )

        const disposition = response.headers['content-disposition']
        const match = disposition && /filename="([^"]+)"/.exec(disposition)
        const filename = match ? match[1] : `LCFS-${formSlug}.${format}`

        const url = window.URL.createObjectURL(new Blob([response.data]))
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)

        setDownloadSuccess(true)
        enqueueSnackbar(`Exported as .${format.toUpperCase()} successfully.`, {
          variant: 'success',
          autoHideDuration: 4000
        })
      } catch {
        enqueueSnackbar('Export failed — please check your input and try again.', {
          variant: 'error',
          autoHideDuration: 6000
        })
      } finally {
        setDownloading(null)
      }
    },
    [formSlug, linkKey, organizationName, authenticated, token]
  )

  return { exportForm, downloading, downloadSuccess }
}
