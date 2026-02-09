import { useMemo } from 'react'
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios'
import { useKeycloak } from '@react-keycloak/web'
import { CONFIG } from '@/constants/config'
import { useSnackbar } from 'notistack'
import { useAuthorization } from '@/contexts/AuthorizationContext'

export interface DownloadOptions {
  url: string
  method?: 'get' | 'post' | 'put' | 'delete'
  params?: Record<string, unknown>
  data?: Record<string, unknown>
}

export interface ApiServiceInstance extends AxiosInstance {
  download: (options: DownloadOptions) => Promise<void>
}

export const useApiService = (
  opts: AxiosRequestConfig = {}
): ApiServiceInstance => {
  const { keycloak } = useKeycloak()
  const { enqueueSnackbar } = useSnackbar()
  const { setForbidden } = useAuthorization()

  // useMemo to memoize the apiService instance
  const apiService = useMemo(() => {
    const instance = axios.create({
      baseURL: CONFIG.API_BASE,
      ...opts
    }) as ApiServiceInstance

    instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (keycloak.authenticated) {
          config.headers.Authorization = `Bearer ${keycloak.token}`
        }
        return config
      },
      (error: unknown) => {
        return Promise.reject(error)
      }
    )

    // Add response interceptor
    instance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: {
        response?: { status: number; data: unknown }
        message?: string
      }) => {
        if (error.response?.status && error.response.status >= 400 && error.response.status !== 403) {
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
    }: DownloadOptions): Promise<void> => {
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

const extractFilename = (response: AxiosResponse): string | null => {
  const contentDisposition = response.headers['content-disposition']
  if (contentDisposition) {
    const matches = /filename="([^"]+)"/.exec(contentDisposition)
    if (matches && matches.length > 1) {
      return matches[1].replace(/"/g, '')
    }
  }
  return null
}

const generateDefaultFilename = (url: string): string => {
  const currentDate = new Date().toISOString().substring(0, 10)
  const extension = url.substring(url.lastIndexOf('/') + 1)
  return `BC-LCFS-${currentDate}.${extension}`
}

const triggerDownload = (url: string, filename: string): void => {
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.parentNode?.removeChild(link)
  window.URL.revokeObjectURL(url)
}
