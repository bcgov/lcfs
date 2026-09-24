import { ApiDocs } from '@/components/ApiDocs'
import { screen } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { expect } from 'vitest'
import { test } from '@/tests/utils/fixtures'

const keycloak = vi.hoisted(() => ({
  useKeycloak: vi.fn()
}))
vi.mock('@react-keycloak/web', () => keycloak)

describe('ApiDocs.jsx', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })
  describe('is not authenticated', () => {
    test('should render login', async ({
      render,
      renderHook,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      keycloak.useKeycloak.mockReturnValue({
        keycloak: { authenticated: false }
      })

      renderHook(
        () => useTranslation(),
        [query, theme, localization, router, i18n]
      )

      render(<ApiDocs />, [query, theme, localization, router, i18n])

      const login = await screen.findByTestId('login')

      expect(login).toBeInTheDocument()
    })
  })
  describe('is authenticated', () => {
    test('should render ApiDocs', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
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

      render(<ApiDocs />, [query, theme, localization, router, i18n])

      const docs = screen.getByTestId('swaggerui')

      expect(docs).toBeInTheDocument()
      expect(
        screen.getByText('http://localhost:8000/api/openapi.json')
      ).toBeInTheDocument()
      expect(screen.getByText('Bearer idToken')).toBeInTheDocument()
    })
  })
})
