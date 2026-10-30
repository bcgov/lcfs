import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vite-plus/test'
import { ciApplicationRoutes } from '../routeConfig/ciApplicationRoutes'
import ROUTES from '../routes'

vi.mock('@/constants/config', () => ({
  FEATURE_FLAGS: { CI_APPLICATIONS: 'ci-applications' },
  isFeatureEnabled: () => true
}))

vi.mock('@/views/CarbonIntensity', async () => {
  const { useState } = await import('react')
  return {
    CIApplications: () => null,
    EditViewCIApplication: () => {
      const [expanded, setExpanded] = useState(false)
      return (
        <button onClick={() => setExpanded(true)}>
          {expanded ? 'Section expanded' : 'Expand section'}
        </button>
      )
    }
  }
})

describe('CI application routes', () => {
  it('preserves wizard state when saving a new draft navigates from Add to Edit', async () => {
    const router = createMemoryRouter(ciApplicationRoutes, {
      initialEntries: [ROUTES.CI_APPLICATIONS.ADD]
    })
    render(<RouterProvider router={router} />)
    fireEvent.click(screen.getByRole('button', { name: 'Expand section' }))

    await act(() =>
      router.navigate(
        ROUTES.CI_APPLICATIONS.EDIT.replace(':ciApplicationId', '123')
      )
    )

    expect(
      screen.getByRole('button', { name: 'Section expanded' })
    ).toBeInTheDocument()
  })
})
