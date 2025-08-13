import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { Notifications } from '../Notifications'

// Mock dependencies
const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ 
    data: { 
      isGovernmentUser: true,
      roles: [{ name: 'Analyst' }]
    } 
  })
}))

const refetchMock = vi.fn()
const markAsReadMutateMock = vi.fn()
const deleteMutateMock = vi.fn()

vi.mock('@/hooks/useNotifications', () => ({
  useGetNotificationMessages: () => ({ refetch: refetchMock }),
  useMarkNotificationAsRead: () => ({ mutate: markAsReadMutateMock }),
  useDeleteNotificationMessages: () => ({ mutate: deleteMutateMock })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/components/BCButton', () => ({
  default: ({ children, ...props }) => (
    <button data-test={props['data-test']} data-testid={props['data-test']} {...props}>
      {children}
    </button>
  )
}))

vi.mock('@/components/ClearFiltersButton', () => ({
  ClearFiltersButton: ({ onClick }) => (
    <button onClick={onClick}>Clear Filters</button>
  )
}))

// Import actual routes mapping
import { routesMapping } from '../_schema'
import { ROUTES } from '@/routes/routes'

vi.mock('../_schema', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    columnDefs: (t, currentUser) => [],
    // Use the actual routesMapping function
    routesMapping: actual.routesMapping
  }
})

// Helper to create wrapper with QueryClient and Theme
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  const { MemoryRouter } = require('react-router-dom')
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>{children}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('Fuel Code Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Routing Logic', () => {
    it('correctly maps fuel code notification types to routes', () => {
      const currentUser = { isGovernmentUser: true }
      const mapping = routesMapping(currentUser)
      
      expect(mapping['Fuel Code Recommended']).toBe(ROUTES.FUEL_CODES.EDIT)
      expect(mapping['Fuel Code Approved']).toBe(ROUTES.FUEL_CODES.EDIT)
      expect(mapping['Fuel Code Returned']).toBe(ROUTES.FUEL_CODES.EDIT)
      expect(mapping['Fuel Code Draft']).toBe(ROUTES.FUEL_CODES.EDIT)
      expect(mapping['Fuel Code Status Update']).toBe(ROUTES.FUEL_CODES.EDIT)
    })
  })

  describe('Notification Type Display', () => {
    it('displays correct notification type for fuel code statuses', () => {
      const fuelCodeTypes = [
        'Fuel Code Recommended',
        'Fuel Code Approved',
        'Fuel Code Returned'
      ]

      fuelCodeTypes.forEach(type => {
        const currentUser = { isGovernmentUser: true }
        const mapping = routesMapping(currentUser)
        expect(mapping[type]).toBeDefined()
        expect(mapping[type]).toBe(ROUTES.FUEL_CODES.EDIT)
      })
    })
  })
})