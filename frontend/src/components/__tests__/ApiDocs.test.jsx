import { ApiDocs } from '@/components/ApiDocs'
import { wrapper } from '@/tests/utils/wrapper'
import { render, renderHook, screen } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { expect } from 'vitest'

const keycloak = vi.hoisted(() => ({
  useKeycloak: vi.fn()
}))
vi.mock('@react-keycloak/web', () => keycloak)

describe('ApiDocs.jsx', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })
  describe('is not authenticated', () => {
    it('should render login', async () => {
      keycloak.useKeycloak.mockReturnValue({
        keycloak: { authenticated: false }
      })

      renderHook(() => useTranslation(), { wrapper })

      render(<ApiDocs />, { wrapper })

      const login = await screen.findByTestId('login')

      expect(login).toBeInTheDocument()
    })
  })
  describe('is authenticated', () => {
    it('should render ApiDocs', () => {
      vi.mock('swagger-ui-react', () => ({
        default: ({ url, requestInterceptor }) => {
          return (
            <div data-test="swaggerui">
              <p>{url}</p>
              <p>{requestInterceptor({ headers: {} }).headers.Authorization}</p>
            </div>
          )
        }
      }))
      keycloak.useKeycloak.mockReturnValue({
        keycloak: { authenticated: true, idToken: 'idToken' }
      })

      render(<ApiDocs />, { wrapper })

      const docs = screen.getByTestId('swaggerui')

      expect(docs).toBeInTheDocument()
      expect(
        screen.getByText('http://localhost:8000/api/openapi.json')
      ).toBeInTheDocument()
      expect(screen.getByText('Bearer idToken')).toBeInTheDocument()
    })
  })
})
