import { useMemo } from 'react'
import axios from 'axios'
import { useKeycloak } from '@react-keycloak/web'
import { CONFIG } from '@/constants/config'
import { useSnackbar } from 'notistack'
import { useAuthorization } from '@/contexts/AuthorizationContext'

export const useApiService = (opts = {}) => {
  const { keycloak } = useKeycloak()
  const { enqueueSnackbar } = useSnackbar()
  const { setForbidden } = useAuthorization()

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

    // Add response interceptor
    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status >= 400 && error.response?.status !== 403) {
          console.error(
            'API Error:',
            error.response.status,
            error.response.data
          )
          if (CONFIG.ENVIRONMENT === 'development') {
            enqueueSnackbar(`${error.response.status} error`, {
              autoHideDuration: 5000,
              variant: 'error'
            })
          }
        }
        if (error.response?.status === 403) {
          setForbidden(true)
        }

        return Promise.reject(error)
      }
    )

    // Download method
    instance.download = async ({
      url,
      method = 'get',
      params = {},
      data = {}
    }) => {
      try {
        const response = await instance.request({
          url,
          method,
          params,
          data,
          responseType: 'blob'
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
