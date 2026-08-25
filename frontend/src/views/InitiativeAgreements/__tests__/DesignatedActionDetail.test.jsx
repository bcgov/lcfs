import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { roles } from '@/constants/roles'
import { wrapper } from '@/tests/utils/wrapper'
import { DesignatedActionDetail } from '../DesignatedActionDetail'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: { token: 'mock-token', authenticated: true, initialized: true }
  })
}))

let mockRoles = [{ name: roles.ia_analyst }]
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { roles: mockRoles },
    hasRoles: (...names) =>
      names.some((n) => mockRoles.some((r) => r.name === n)),
    hasAnyRole: (...names) =>
      names.some((n) => mockRoles.some((r) => r.name === n))
  })
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useParams: () => ({ initiativeAgreementId: '5', designatedActionId: '9' })
  }
})

const commentsProps = vi.fn()
vi.mock('@/components/Comments', () => ({
  default: (props) => {
    commentsProps(props)
    return <div data-test="comments-component" />
  }
}))

describe('DesignatedActionDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoles = [{ name: roles.ia_analyst }]
  })

  it('renders the wireframe identifier in the title', () => {
    render(<DesignatedActionDetail />, { wrapper })
    expect(
      screen.getByTestId('designated-action-detail-title')
    ).toHaveTextContent('DA9-IA5')
  })

  it('wires the dual-mode comment thread to the designated action', () => {
    render(<DesignatedActionDetail />, { wrapper })

    expect(screen.getByTestId('comments-component')).toBeInTheDocument()
    expect(commentsProps).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'designatedAction',
        entityId: 9,
        commentMode: 'dual'
      })
    )
  })
})
