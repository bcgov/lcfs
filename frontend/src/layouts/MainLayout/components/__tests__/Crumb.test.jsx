import React from 'react'
import { render, screen } from '@testing-library/react'
import Crumb from '../Crumb'
import { vi, describe, it, expect } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import { useLocation, useMatches, useParams } from 'react-router-dom'

// Mock router hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useLocation: vi.fn(),
    useMatches: vi.fn(),
    useParams: vi.fn()
  }
})

describe('Crumb', () => {
  // Helper to set up the router mocks
  const setupRouterMocks = ({
    pathname = '/',
    matches = [{ handle: {} }],
    params = {}
  } = {}) => {
    useLocation.mockReturnValue({ pathname })
    useMatches.mockReturnValue(matches)
    useParams.mockReturnValue(params)
  }

  beforeEach(() => {
    setupRouterMocks()
  })

  it('renders the home link when on a path', () => {
    setupRouterMocks({ pathname: '/admin' })

    render(<Crumb />, { wrapper })

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Administration')).toBeInTheDocument()
  })

  it('does not render breadcrumb items when on the home path', () => {
    setupRouterMocks({ pathname: '/' })

    const { container } = render(<Crumb />, { wrapper })

    // Verify that breadcrumb nav exists but has no items
    const breadcrumb = container.querySelector('[aria-label="breadcrumb"]')
    expect(breadcrumb).toBeInTheDocument()
    // The breadcrumbs ol might still render, but should be empty
    const items = container.querySelectorAll('.MuiBreadcrumbs-li')
    expect(items.length).toBe(0)
  })

  it('displays custom breadcrumb for admin path', () => {
    setupRouterMocks({ pathname: '/admin' })

    render(<Crumb />, { wrapper })

    expect(screen.getByText('Administration')).toBeInTheDocument()
  })

  it('displays the title from route metadata when available', () => {
    setupRouterMocks({
      pathname: '/admin',
      matches: [{ handle: { title: 'Admin Dashboard' } }]
    })

    render(<Crumb />, { wrapper })

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
  })

  it('displays numeric IDs with ID prefix', () => {
    setupRouterMocks({
      pathname: '/transactions/12345',
      matches: [{ handle: {} }]
    })

    render(<Crumb />, { wrapper })

    expect(screen.getByText('ID: 12345')).toBeInTheDocument()
  })

  it('displays user profile breadcrumb for user ID with edit', () => {
    setupRouterMocks({
      pathname: '/users/789/edit-user',
      params: { userID: '789' }
    })

    render(<Crumb />, { wrapper })

    expect(screen.getByText('User profile')).toBeInTheDocument()
  })

  it('displays organization ID in breadcrumb', () => {
    setupRouterMocks({
      pathname: '/organizations/456',
      params: { orgID: '456' }
    })

    render(<Crumb />, { wrapper })

    expect(screen.getByText('ID: 456')).toBeInTheDocument()
    expect(screen.getByText('Organizations')).toBeInTheDocument()
  })

  it('handles compliance report paths correctly', () => {
    setupRouterMocks({
      pathname: '/compliance-reporting/2023/123',
      params: {
        compliancePeriod: '2023',
        complianceReportId: '123'
      }
    })

    render(<Crumb />, { wrapper })

    expect(screen.getByText('Compliance reporting')).toBeInTheDocument()
    expect(screen.getByText('2023 Compliance report')).toBeInTheDocument()
  })
})
