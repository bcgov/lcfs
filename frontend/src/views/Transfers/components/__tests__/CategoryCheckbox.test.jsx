import { fireEvent, render, screen } from '@testing-library/react'
import { CategoryCheckbox } from '../CategoryCheckbox'
import { wrapper } from '@/tests/utils/wrapper'
import { expect } from 'vitest'

const keycloak = vi.hoisted(() => ({
  useKeycloak: vi.fn()
}))
vi.mock('@react-keycloak/web', () => keycloak)

describe('CategoryCheckbox', () => {
  beforeEach(() => {
    keycloak.useKeycloak.mockReturnValue({
      keycloak: { authenticated: true },
      initialized: true
    })
  })
  it('should render', () => {
    render(<CategoryCheckbox />, {
      wrapper
    })
    expect(screen.getByTestId('category-checkbox')).toBeInTheDocument()
  })
  it('should check/uncheck the checkbox on click', () => {
    const { container } = render(<CategoryCheckbox />, {
      wrapper
    })

    const checkbox = container.querySelector('input[type="checkbox"]')

    expect(checkbox).toBeInTheDocument()
  })
})
