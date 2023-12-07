import { useMemo } from 'react'
import axios from 'axios'
import { useKeycloak } from '@react-keycloak/web'
import CONFIG from '@/config'

const useApiService = (opts = {}) => {
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

    return instance
  }, [keycloak.authenticated, keycloak.token, opts]) // Dependencies array

  return apiService
}

export default useApiService
