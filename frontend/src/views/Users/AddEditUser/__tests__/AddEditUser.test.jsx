import React from 'react'
import { AddEditUser } from '@/views/Users'
import { apiRoutes } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import { wrapper } from '@/tests/utils/wrapper'
import { describe, it } from 'vitest'
import { HttpResponse } from 'msw'
import { httpOverwrite } from '@/tests/utils/handlers'

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: vi.fn().mockReturnValue({
    keycloak: { authenticated: true }
  })
}))

describe('AddEditUser', () => {
  beforeEach(async () => {
    httpOverwrite('get', apiRoutes.currentUser, () =>
      HttpResponse.json({
        roles: [{ name: 'Government' }]
      })
    )
    const { result } = renderHook(useCurrentUser, { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('renders the form to add IDIR user', async () => {
    const { container } = render(<AddEditUser />, { wrapper })

    // Check if the container HTML element contains the form
    expect(container.querySelector('form#user-form')).toBeInTheDocument()

    // You can also check for specific elements within the form if needed
    expect(
      container.querySelector('[data-test="saveUser"]')
    ).toBeInTheDocument()
  })
})
