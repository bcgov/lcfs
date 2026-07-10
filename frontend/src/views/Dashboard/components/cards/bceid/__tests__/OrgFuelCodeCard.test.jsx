import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import OrgFuelCodeCard from '../OrgFuelCodeCard'
import { useOrgFuelCodeCounts } from '@/hooks/useDashboard'
import { wrapper } from '@/tests/utils/wrapper'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'

// Mock dependencies
vi.mock('@/hooks/useDashboard')
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: vi.fn()
}))
vi.mock('@/utils/withRole', () => ({
  __esModule: true,
  default: (Component) => Component
}))

// Mock components
vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  __esModule: true,
  default: ({ title, content, ...props }) => (
    <div data-test="bc-widget-card" {...props}>
      <div data-test="widget-title">{title}</div>
      <div data-test="widget-content">{content}</div>
    </div>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  __esModule: true,
  default: ({ children, ...props }) => (
    <div data-test="bc-typography" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/Loading', () => ({
  __esModule: true,
  default: ({ message }) => <div data-test="loading">{message}</div>
}))

vi.mock('@mui/material', () => ({
  Stack: ({ children, ...props }) => (
    <div data-test="stack" {...props}>
      {children}
    </div>
  ),
  List: ({ children, ...props }) => (
    <div data-test="list" {...props}>
      {children}
    </div>
  ),
  ListItemButton: ({ children, onClick, ...props }) => (
    <button data-test="list-item-button" onClick={onClick} {...props}>
      {children}
    </button>
  )
}))

describe('OrgFuelCodeCard Component', () => {
  const mockNavigate = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    useNavigate.mockReturnValue(mockNavigate)
  })

  describe('Loading state', () => {
    it('renders loading message and title while loading', () => {
      useOrgFuelCodeCounts.mockReturnValue({ data: null, isLoading: true })

      render(<OrgFuelCodeCard />, { wrapper })

      expect(screen.getByTestId('loading')).toBeInTheDocument()
      expect(screen.getByText(/Loading fuel codes card/)).toBeInTheDocument()
      expect(screen.getByText('Fuel codes')).toBeInTheDocument()
    })
  })

  describe('With applications', () => {
    it('shows both counts and the "There are:" header', () => {
      useOrgFuelCodeCounts.mockReturnValue({
        data: { draft: 2, submitted: 3 },
        isLoading: false
      })

      render(<OrgFuelCodeCard />, { wrapper })

      expect(screen.getByText(/There are:/)).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(
        screen.getByText(/Carbon intensity application\(s\) in draft/)
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          /Carbon intensity application\(s\) submitted for government review/
        )
      ).toBeInTheDocument()
    })

    it('hides the draft link when draft is 0 but shows submitted', () => {
      useOrgFuelCodeCounts.mockReturnValue({
        data: { draft: 0, submitted: 1 },
        isLoading: false
      })

      render(<OrgFuelCodeCard />, { wrapper })

      expect(
        screen.queryByText(/Carbon intensity application\(s\) in draft/)
      ).not.toBeInTheDocument()
      expect(
        screen.getByText(
          /Carbon intensity application\(s\) submitted for government review/
        )
      ).toBeInTheDocument()
    })

    it('navigates to the CI applications list from the draft count link', () => {
      useOrgFuelCodeCounts.mockReturnValue({
        data: { draft: 2, submitted: 0 },
        isLoading: false
      })

      render(<OrgFuelCodeCard />, { wrapper })

      fireEvent.click(
        screen.getByText(/Carbon intensity application\(s\) in draft/)
      )
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.CI_APPLICATIONS.LIST)
    })
  })

  describe('Empty state', () => {
    it.each([
      { draft: 0, submitted: 0 },
      undefined,
      null,
      {}
    ])('shows the no-applications message when there is nothing in progress (%o)', (data) => {
      useOrgFuelCodeCounts.mockReturnValue({ data, isLoading: false })

      render(<OrgFuelCodeCard />, { wrapper })

      expect(
        screen.getByText(
          /There are no carbon intensity applications in progress./
        )
      ).toBeInTheDocument()
      expect(screen.queryByText(/There are:/)).not.toBeInTheDocument()
    })
  })

  describe('Action links (always present)', () => {
    beforeEach(() => {
      useOrgFuelCodeCounts.mockReturnValue({
        data: { draft: 0, submitted: 0 },
        isLoading: false
      })
    })

    it('navigates to the CI applications list via "View all"', () => {
      render(<OrgFuelCodeCard />, { wrapper })
      fireEvent.click(screen.getByText(/View all carbon intensity applications/))
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.CI_APPLICATIONS.LIST)
    })

    it('navigates to the add page via "Start a new application"', () => {
      render(<OrgFuelCodeCard />, { wrapper })
      fireEvent.click(screen.getByText(/Start a new application/))
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.CI_APPLICATIONS.ADD)
    })
  })

  describe('Hooks and card props', () => {
    it('calls the counts hook and renders the widget title', () => {
      useOrgFuelCodeCounts.mockReturnValue({
        data: { draft: 1, submitted: 0 },
        isLoading: false
      })

      render(<OrgFuelCodeCard />, { wrapper })

      expect(useOrgFuelCodeCounts).toHaveBeenCalled()
      expect(useNavigate).toHaveBeenCalled()
      expect(screen.getByTestId('widget-title')).toHaveTextContent('Fuel codes')
    })
  })
})
