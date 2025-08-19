import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import axios from 'axios'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import { ReactKeycloakProvider, useKeycloak } from '@react-keycloak/web'
import FormView from '../FormView'

vi.mock('axios')

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({ keycloak: { authenticated: true, token: 't' } }),
  ReactKeycloakProvider: ({ children }) => children
}))

const renderWithRouter = (path) => {
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
  })

  it('loads authenticated form when no linkKey', async () => {
    axios.get.mockResolvedValue({ data: { name: 'My Form', status: 'ok' } })
    renderWithRouter('/forms/foo')
    await waitFor(() => expect(screen.getByText('My Form')).toBeInTheDocument())
    expect(axios.get).toHaveBeenCalled()
  })

  it('loads anonymous form when linkKey provided', async () => {
    axios.get.mockResolvedValue({ data: { name: 'Anon', status: 'ok' } })
    renderWithRouter('/forms/foo/abc123')
    await waitFor(() => expect(screen.getByText('Anon')).toBeInTheDocument())
  })

  it('shows error message when API fails', async () => {
    axios.get.mockRejectedValue({ response: { status: 404 } })
    renderWithRouter('/forms/foo/badkey')
    await waitFor(() =>
      expect(screen.getByText(/Form Access Error/i)).toBeInTheDocument()
    )
  })
})
