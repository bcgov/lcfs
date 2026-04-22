import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import axios from 'axios'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import FormView from '../FormView'
import { CONFIG } from '@/constants/config'

vi.mock('axios')

vi.mock('../registry', () => ({
  FORM_COMPONENTS: {
    'test-form': () => <div>Mock Form Component</div>
  }
}))

let mockKeycloak = {
  authenticated: true,
  token: 'mock-token'
}

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({ keycloak: mockKeycloak }),
  ReactKeycloakProvider: ({ children }) => children
}))

const renderWithRouter = (path, keycloakOverride = {}) => {
  if (keycloakOverride) {
    mockKeycloak = { ...mockKeycloak, ...keycloakOverride }
  }

  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/forms/:formSlug" element={<FormView />} />
          <Route path="/forms/:formSlug/:linkKey" element={<FormView />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>
  )
}

describe('FormView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockKeycloak.authenticated = true
    mockKeycloak.token = 'mock-token'
  })

  describe('Basic Rendering', () => {
    it('shows loading state initially', async () => {
      axios.get.mockImplementation(() => new Promise(() => {}))
      renderWithRouter('/forms/test-form')

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })

  describe('Success States', () => {
    it('renders form name and description', async () => {
      const mockData = {
        name: 'Test Form',
        description: 'Test Description',
        organization_name: 'Test Org',
        status: 'Active',
        message: 'Form is ready',
        form_id: 'FORM123',
        slug: 'test-form'
      }

      axios.get.mockResolvedValue({ data: mockData })
      renderWithRouter('/forms/test-form')

      await waitFor(() => {
        expect(screen.getByText('Test Form')).toBeInTheDocument()
        expect(screen.getByText('Test Description')).toBeInTheDocument()
      })
    })

    it('renders form without description', async () => {
      const mockData = {
        name: 'Test Form',
        organization_name: 'Test Org',
        status: 'Active',
        message: 'Form is ready',
        form_id: 'FORM123',
        slug: 'test-form'
      }

      axios.get.mockResolvedValue({ data: mockData })
      renderWithRouter('/forms/test-form')

      await waitFor(() => {
        expect(screen.getByText('Test Form')).toBeInTheDocument()
        expect(screen.queryByText(/Test Description/)).not.toBeInTheDocument()
      })
    })

    it('renders form without organization name', async () => {
      const mockData = {
        name: 'Test Form',
        description: 'Test Description',
        status: 'Active',
        message: 'Form is ready',
        form_id: 'FORM123',
        slug: 'test-form'
      }

      axios.get.mockResolvedValue({ data: mockData })
      renderWithRouter('/forms/test-form')

      await waitFor(() => {
        expect(screen.getByText('Test Form')).toBeInTheDocument()
        expect(screen.queryByText(/Organization:/)).not.toBeInTheDocument()
      })
    })

    it('shows unsupported message for unknown form slug', async () => {
      const mockData = { name: 'Unknown Form', status: 'Active' }
      axios.get.mockResolvedValue({ data: mockData })
      renderWithRouter('/forms/unknown-form')

      await waitFor(() => {
        expect(
          screen.getByText(/is not yet supported/)
        ).toBeInTheDocument()
      })
    })
  })

  describe('Authentication Paths', () => {
    it('uses authenticated API endpoint when no linkKey', async () => {
      const mockData = { name: 'Auth Form', status: 'Active' }
      axios.get.mockResolvedValue({ data: mockData })

      renderWithRouter('/forms/test-form')

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          `${CONFIG.API_BASE}/forms/test-form`,
          {
            headers: {
              Authorization: 'Bearer mock-token'
            }
          }
        )
      })
    })

    it('uses anonymous API endpoint when linkKey provided', async () => {
      const mockData = { name: 'Anon Form', status: 'Active' }
      axios.get.mockResolvedValue({ data: mockData })

      renderWithRouter('/forms/test-form/abc123')

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          `${CONFIG.API_BASE}/forms/test-form/abc123`,
          {}
        )
      })
    })

    it('handles unauthenticated keycloak for authenticated route', async () => {
      const mockData = { name: 'Test Form', status: 'Active' }
      axios.get.mockResolvedValue({ data: mockData })

      renderWithRouter('/forms/test-form', { authenticated: false })

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          `${CONFIG.API_BASE}/forms/test-form`,
          {}
        )
      })
    })
  })

  describe('Error Handling', () => {
    it('displays error for 404 with anonymous access', async () => {
      axios.get.mockRejectedValue({ response: { status: 404 } })
      renderWithRouter('/forms/test-form/invalid-key')

      await waitFor(() => {
        expect(screen.getByText('Failed to load form.')).toBeInTheDocument()
      })
    })

    it('displays error for 404 with authenticated access', async () => {
      axios.get.mockRejectedValue({ response: { status: 404 } })
      renderWithRouter('/forms/test-form')

      await waitFor(() => {
        expect(screen.getByText('Failed to load form.')).toBeInTheDocument()
      })
    })

    it('displays error for 401 with anonymous access', async () => {
      axios.get.mockRejectedValue({ response: { status: 401 } })
      renderWithRouter('/forms/test-form/key123')

      await waitFor(() => {
        expect(screen.getByText('Failed to load form.')).toBeInTheDocument()
      })
    })

    it('displays error for 401 with authenticated access', async () => {
      axios.get.mockRejectedValue({ response: { status: 401 } })
      renderWithRouter('/forms/test-form')

      await waitFor(() => {
        expect(screen.getByText('Failed to load form.')).toBeInTheDocument()
      })
    })

    it('displays error for connection refused', async () => {
      axios.get.mockRejectedValue({ code: 'ECONNREFUSED' })
      renderWithRouter('/forms/test-form')

      await waitFor(() => {
        expect(screen.getByText('Failed to load form.')).toBeInTheDocument()
      })
    })

    it('displays custom error from response data', async () => {
      axios.get.mockRejectedValue({
        response: { data: { detail: 'Custom error message' } }
      })
      renderWithRouter('/forms/test-form')

      await waitFor(() => {
        expect(screen.getByText('Custom error message')).toBeInTheDocument()
      })
    })

    it('displays generic error message', async () => {
      axios.get.mockRejectedValue({ message: 'Network error' })
      renderWithRouter('/forms/test-form')

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('displays fallback error message', async () => {
      axios.get.mockRejectedValue({})
      renderWithRouter('/forms/test-form')

      await waitFor(() => {
        expect(screen.getByText('Failed to load form.')).toBeInTheDocument()
      })
    })
  })

  describe('UseEffect Dependencies', () => {
    it('does not fetch when formSlug is undefined', async () => {
      render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/forms']}>
            <Routes>
              <Route path="/forms" element={<FormView />} />
            </Routes>
          </MemoryRouter>
        </I18nextProvider>
      )

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
      })

      expect(axios.get).not.toHaveBeenCalled()
    })
  })
})
