import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import axios from 'axios'

// Mock React to override useMemo
vi.mock('react', async () => {
  const actual = await vi.importActual('react')
  return {
    ...actual,
    useMemo: vi.fn((fn) => fn()) // Always execute the function immediately
  }
})

// Mock dependencies
const mockKeycloak = { authenticated: false, token: null }
const mockEnqueueSnackbar = vi.fn()
const mockSetForbidden = vi.fn()

vi.mock('axios')
vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({ keycloak: mockKeycloak })
}))
vi.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar })
}))
vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({ setForbidden: mockSetForbidden })
}))
vi.mock('@/constants/config', () => ({
  CONFIG: {
    API_BASE: 'http://localhost:8000/api',
    ENVIRONMENT: 'development'
  }
}))

// Mock console methods to avoid noise in tests
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

// Mock DOM APIs for download functionality
const mockCreateElement = vi.fn()
const mockAppendChild = vi.fn()
const mockRemoveChild = vi.fn()
const mockClick = vi.fn()
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()

Object.defineProperty(document, 'createElement', {
  value: mockCreateElement,
  writable: true
})
Object.defineProperty(document.body, 'appendChild', {
  value: mockAppendChild,
  writable: true
})
Object.defineProperty(document.body, 'removeChild', {
  value: mockRemoveChild,
  writable: true
})
Object.defineProperty(window.URL, 'createObjectURL', {
  value: mockCreateObjectURL,
  writable: true
})
Object.defineProperty(window.URL, 'revokeObjectURL', {
  value: mockRevokeObjectURL,
  writable: true
})

describe('useApiService', () => {
  const mockAxiosInstance = {
    request: vi.fn(),
    interceptors: {
      request: {
        use: vi.fn(),
      },
      response: {
        use: vi.fn(),
      },
    },
  }

  let useApiService

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Setup axios mock
    const mockedAxios = vi.mocked(axios)
    mockedAxios.create.mockReturnValue(mockAxiosInstance)

    // Reset mock state
    mockKeycloak.authenticated = false
    mockKeycloak.token = null

    // Setup DOM element mock
    const mockElement = {
      href: '',
      setAttribute: vi.fn(),
      click: mockClick,
      parentNode: {
        removeChild: mockRemoveChild,
      },
    }
    mockCreateElement.mockReturnValue(mockElement)
    mockCreateObjectURL.mockReturnValue('blob:mock-url')

    // Import the hook after mocks are set up
    const module = await import('../useApiService')
    useApiService = module.useApiService
  })

  afterEach(() => {
    vi.resetAllMocks()
    mockConsoleError.mockClear()
  })

  describe('Basic Setup', () => {
    it('should create axios instance with correct baseURL', () => {
      const result = useApiService()

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:8000/api',
      })
      expect(result).toBe(mockAxiosInstance)
    })

    it('should create axios instance with custom options', () => {
      const customOpts = { timeout: 5000 }
      const result = useApiService(customOpts)

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:8000/api',
        timeout: 5000,
      })
      expect(result).toBe(mockAxiosInstance)
    })

    it('should setup request and response interceptors', () => {
      useApiService()

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled()
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled()
    })
  })

  describe('Request Interceptor', () => {
    it('should add Authorization header when authenticated', () => {
      // useMemo is mocked globally

      mockKeycloak.authenticated = true
      mockKeycloak.token = 'mock-token'

      useApiService()

      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0]
      const config = { headers: {} }
      
      const result = requestInterceptor(config)

      expect(result.headers.Authorization).toBe('Bearer mock-token')

    })

    it('should not add Authorization header when not authenticated', () => {
      // useMemo is mocked globally

      mockKeycloak.authenticated = false

      useApiService()

      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0]
      const config = { headers: {} }
      
      const result = requestInterceptor(config)

      expect(result.headers.Authorization).toBeUndefined()

    })

    it('should handle request interceptor errors', async () => {
      // useMemo is mocked globally

      useApiService()

      const requestErrorHandler = mockAxiosInstance.interceptors.request.use.mock.calls[0][1]
      const error = new Error('Request error')
      
      await expect(() => requestErrorHandler(error)).rejects.toThrow('Request error')

    })
  })

  describe('Response Interceptor', () => {
    it('should pass through successful responses', () => {
      // useMemo is mocked globally

      useApiService()

      const responseInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][0]
      const response = { data: { success: true }, status: 200 }
      
      const result = responseInterceptor(response)

      expect(result).toBe(response)

    })

    describe('Error Handling', () => {
      it('should log console error for 4xx errors (except 403)', async () => {
        // useMemo is mocked globally

        useApiService()

        const responseErrorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1]
        const error = {
          response: {
            status: 400,
            data: { message: 'Bad Request' }
          }
        }
        
        await expect(() => responseErrorHandler(error)).rejects.toThrow()
        expect(mockConsoleError).toHaveBeenCalledWith(
          'API Error:',
          400,
          { message: 'Bad Request' }
        )

      })

      it('should show snackbar error in development environment', async () => {
        // useMemo is mocked globally

        useApiService()

        const responseErrorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1]
        const error = {
          response: {
            status: 404,
            data: { message: 'Not Found' }
          }
        }
        
        await expect(() => responseErrorHandler(error)).rejects.toThrow()
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
          '404 error',
          {
            autoHideDuration: 5000,
            variant: 'error'
          }
        )

      })

      it('should handle 403 forbidden errors by setting forbidden state', async () => {
        // useMemo is mocked globally

        useApiService()

        const responseErrorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1]
        const error = {
          response: {
            status: 403,
            data: { message: 'Forbidden' }
          }
        }
        
        await expect(() => responseErrorHandler(error)).rejects.toThrow()
        expect(mockSetForbidden).toHaveBeenCalledWith(true)
        expect(mockConsoleError).not.toHaveBeenCalled()
        expect(mockEnqueueSnackbar).not.toHaveBeenCalled()

      })

      it('should handle network errors without response', async () => {
        // useMemo is mocked globally

        useApiService()

        const responseErrorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1]
        const error = {
          message: 'Network Error'
        }
        
        await expect(() => responseErrorHandler(error)).rejects.toThrow()
        expect(mockConsoleError).not.toHaveBeenCalled()
        expect(mockEnqueueSnackbar).not.toHaveBeenCalled()
        expect(mockSetForbidden).not.toHaveBeenCalled()

      })
    })
  })

  describe('Download Functionality', () => {
    it('should handle successful download with filename from content-disposition', async () => {
      // useMemo is mocked globally

      const mockBlobData = new Blob(['test file content'])
      const mockResponse = {
        data: mockBlobData,
        headers: {
          'content-disposition': 'attachment; filename="test-file.pdf"'
        }
      }

      mockAxiosInstance.request.mockResolvedValue(mockResponse)
      const apiService = useApiService()

      await apiService.download({
        url: '/test-download',
        method: 'get',
        params: { id: 1 },
        data: {}
      })

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        url: '/test-download',
        method: 'get',
        params: { id: 1 },
        data: {},
        responseType: 'blob'
      })

      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      expect(mockCreateElement).toHaveBeenCalledWith('a')
      expect(mockAppendChild).toHaveBeenCalled()
      expect(mockClick).toHaveBeenCalled()
      expect(mockRemoveChild).toHaveBeenCalled()
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

    })

    it('should use default filename when content-disposition is missing', async () => {
      // useMemo is mocked globally

      const mockBlobData = new Blob(['test file content'])
      const mockResponse = {
        data: mockBlobData,
        headers: {}
      }

      mockAxiosInstance.request.mockResolvedValue(mockResponse)
      const apiService = useApiService()

      await apiService.download({
        url: '/reports/compliance'
      })

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        url: '/reports/compliance',
        method: 'get',
        params: {},
        data: {},
        responseType: 'blob'
      })

      // Should use generated default filename
      const mockElement = mockCreateElement.mock.results[0].value
      const expectedDate = new Date().toISOString().substring(0, 10)
      expect(mockElement.setAttribute).toHaveBeenCalledWith(
        'download',
        `BC-LCFS-${expectedDate}.compliance`
      )

    })

    it('should handle download errors', async () => {
      // useMemo is mocked globally

      const error = new Error('Download failed')
      mockAxiosInstance.request.mockRejectedValue(error)
      const apiService = useApiService()

      await expect(apiService.download({
        url: '/test-download'
      })).rejects.toThrow('Download failed')

      expect(mockConsoleError).toHaveBeenCalledWith('Error in download:', error)
      expect(mockCreateObjectURL).not.toHaveBeenCalled()
      expect(mockCreateElement).not.toHaveBeenCalled()

    })
  })

  describe('Edge Cases', () => {
    it('should handle empty options object', () => {
      // useMemo is mocked globally

      useApiService({})

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:8000/api',
      })

    })

    it('should handle null options', () => {
      // useMemo is mocked globally

      useApiService(null)

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:8000/api',
      })

    })

    it('should handle undefined token', () => {
      // useMemo is mocked globally

      mockKeycloak.authenticated = true
      mockKeycloak.token = undefined

      useApiService()

      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0]
      const config = { headers: {} }
      
      const result = requestInterceptor(config)

      expect(result.headers.Authorization).toBe('Bearer undefined')

    })
  })
})