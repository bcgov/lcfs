import { AxiosInstance } from 'axios'

declare module 'axios' {
  interface AxiosInstance {
    download(url: string, params?: Record<string, any>): Promise<void>
  }
}
