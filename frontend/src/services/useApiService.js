import { CONFIG } from '@/constants/config'
// import { Api } from '@/services/apiClient'
import { client } from '@/services/apiClient/services.gen'
import { useKeycloak } from '@react-keycloak/web'
import axios from 'axios'
import { useMemo } from 'react'

export const useApiService = (opts = {}) => {
  const { keycloak } = useKeycloak()

  // useMemo to memoize the apiService instance
  const apiService = useMemo(() => {
    const instance = axios.create({
      baseURL: CONFIG.API_BASE,
      ...opts
    })

    instance.interceptors.request.use(
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
    instance.download = async (url, params = {}) => {
      try {
        const response = await instance.get(url, {
          responseType: 'blob',
          params
        })

        const filename =
          extractFilename(response) || generateDefaultFilename(url)
        const objectURL = window.URL.createObjectURL(new Blob([response.data]))
        triggerDownload(objectURL, filename)
      } catch (error) {
        console.error('Error in download:', error)
        throw error
      }
    }

    return instance
  }, [keycloak.authenticated, keycloak.token, opts]) // Dependencies array

  return apiService
}

const extractFilename = (response) => {
  const contentDisposition = response.headers['content-disposition']
  if (contentDisposition) {
    const matches = /filename="([^"]+)"/.exec(contentDisposition)
    if (matches.length > 1) {
      return matches[1].replace(/"/g, '')
    }
  }
  return null
}

const generateDefaultFilename = (url) => {
  const currentDate = new Date().toISOString().substring(0, 10)
  const extension = url.substring(url.lastIndexOf('/') + 1)
  return `BC-LCFS-${currentDate}.${extension}`
}

const triggerDownload = (url, filename) => {
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.parentNode.removeChild(link)
  window.URL.revokeObjectURL(url)
}
