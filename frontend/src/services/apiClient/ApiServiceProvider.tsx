import { useKeycloak } from '@react-keycloak/web'
import { client } from './services.gen'
import { CONFIG } from '@/constants/config'
import { AxiosResponse } from 'axios'

const extractFilename = (response: AxiosResponse) => {
  const contentDisposition = response.headers['content-disposition']
  if (contentDisposition) {
    const matches = /filename="([^"]+)"/.exec(contentDisposition)
    if (matches && matches.length > 1) {
      return matches[1].replace(/"/g, '')
    }
  }
  return null
}

const generateDefaultFilename = (url: string) => {
  const currentDate = new Date().toISOString().substring(0, 10)
  const extension = url.substring(url.lastIndexOf('/') + 1)
  return `BC-LCFS-${currentDate}.${extension}`
}

const triggerDownload = (url: string, filename: string) => {
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.parentNode?.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export const ApiServiceProvider = ({
  children
}: {
  children: React.JSX.Element
}) => {
  const { keycloak } = useKeycloak()
  client.setConfig({
    baseURL: CONFIG.API_BASE.replace('/api', ''),
    throwOnError: true
  })

  client.instance.interceptors.request.use(
    (config) => {
      if (keycloak.authenticated) {
        config.headers.Authorization = `Bearer ${keycloak.token}`
      }
      return config
    },
    (error) => {
      return Promise.reject(error)
    }
  )

  // Download method
  client.instance.download = async (url, params = {}) => {
    try {
      const response = await client.instance.get(url, {
        responseType: 'blob',
        params
      })

      const filename = extractFilename(response) || generateDefaultFilename(url)
      const objectURL = window.URL.createObjectURL(new Blob([response.data]))
      triggerDownload(objectURL, filename)
    } catch (error) {
      console.error('Error in download:', error)
      throw error
    }
  }

  return children
}

// TODO: add types
