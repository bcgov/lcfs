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

type ErrorResponse = {
  response?: { status: number; data?: unknown; headers?: Record<string, string> }
  message?: string
}

function extractErrorRef(error: ErrorResponse): string | null {
  const res = error.response
  if (!res) return null
  const body = res.data
  if (body && typeof body === 'object' && 'reference_number' in body) {
    const ref = (body as { reference_number: unknown }).reference_number
    if (typeof ref === 'string') return ref
  }
  const header = res.headers?.['x-correlation-id']
  return typeof header === 'string' ? header : null
}

export const useApiService = (opts: AxiosRequestConfig = {}): ApiServiceInstance => {
  const { keycloak } = useKeycloak()
  const { enqueueSnackbar } = useSnackbar()
  const { setForbidden, addErrorRef, setErrorStatus, serverErrorBlockedRef } = useAuthorization()

  // useMemo to memoize the apiService instance
  const apiService = useMemo(() => {
    const instance = axios.create({
      baseURL: CONFIG.API_BASE,
      ...opts
    }) as ApiServiceInstance

    instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (serverErrorBlockedRef.current) {
          return Promise.reject(new Error('Blocked: server is in error state'))
        }
        if (keycloak.authenticated) {
          config.headers.Authorization = `Bearer ${keycloak.token}`
        }
        return config
      },
      (error: unknown) => Promise.reject(error)
    )

    instance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: ErrorResponse) => {
        const status = error.response?.status
        const ref = extractErrorRef(error)
        if (ref) addErrorRef(ref)

        if (status) {
          console.error('API Error:', status, error.response?.data)
          if (status === 403) {
            setForbidden(true)
          } else if (status === 500) {
            setErrorStatus(500)
          } else if (CONFIG.ENVIRONMENT === 'development') {
            const detail =
              (error.response?.data as { detail?: string })?.detail ||
              `${status} error`
            enqueueSnackbar(detail, { autoHideDuration: 5000, variant: 'error' })
          }
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
      const response = await instance.request({
        url,
        method,
        params,
        data,
        responseType: 'blob'
      })
      const filename = extractFilename(response) || generateDefaultFilename(url)
      const objectURL = window.URL.createObjectURL(new Blob([response.data]))
      triggerDownload(objectURL, filename)
    }

    return instance
  }, [keycloak.authenticated, keycloak.token, opts])

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
