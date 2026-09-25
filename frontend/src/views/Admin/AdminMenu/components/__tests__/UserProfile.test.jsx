import React from 'react'
import { vi, describe, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { test } from '@/tests/utils/fixtures'
import { UserProfile } from '../UserProfile'
import * as formatters from '@/utils/formatters'
import * as cellRenderers from '@/utils/grid/cellRenderers'

// Mocks
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }) => (
    <div data-test="bc-box" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, variant, ...props }) => (
    <div data-test="bc-typography" data-variant={variant} {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/utils/formatters')
vi.mock('@/utils/grid/cellRenderers')

const mockUser = {
  firstName: 'John',
  lastName: 'Doe',
  title: 'Software Developer',
  keycloakEmail: 'john.doe@example.com',
  phone: '1234567890',
  mobilePhone: '0987654321',
  organization: {
    name: 'Test Organization'
  },
  roles: [{ name: 'administrator' }, { name: 'user' }]
}

const mockGovernmentUser = {
  firstName: 'Jane',
  lastName: 'Smith',
  title: 'Government Official',
  keycloakEmail: 'jane.smith@gov.bc.ca',
  phone: '5551234567',
  mobilePhone: '5559876543',
  organization: null, // Government users might not have organization
  roles: [{ name: 'government' }]
}

describe('UserProfile Component', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    // Mock the formatters
    vi.mocked(formatters.phoneNumberFormatter).mockImplementation(
      ({ value }) =>
        value
          ? `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`
          : ''
    )

    // Mock the cell renderers with safe defaults
    vi.mocked(cellRenderers.StatusRenderer).mockImplementation(
      ({ data, isView }) => `Status: ${data?.status || 'Active'}`
    )

    vi.mocked(cellRenderers.RoleSpanRenderer).mockImplementation(({ data }) => {
      if (!data || !data.roles || data.roles.length === 0) {
        return ''
      }
      return data.roles.map((role) => role.name).join(', ')
    })
  })

  describe('User Information Display', () => {
    test('renders user basic information correctly', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockUser} />, [
        query,
        theme,
        localization,
        router
      ])

      // Look for user data that should be rendered as plain text
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Software Developer')).toBeInTheDocument()
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument()
      expect(screen.getByText('Test Organization')).toBeInTheDocument()
    })

    test('renders user names with space between first and last name', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockUser} />, [
        query,
        theme,
        localization,
        router
      ])

      // Check that first and last names are rendered together
      expect(
        screen.getByText(
          (content) => content.includes('John') && content.includes('Doe')
        )
      ).toBeInTheDocument()
    })

    test('renders formatted phone numbers', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockUser} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(screen.getByText('(123) 456-7890')).toBeInTheDocument()
      expect(screen.getByText('(098) 765-4321')).toBeInTheDocument()
    })

    test('calls phone number formatter with correct parameters', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockUser} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(formatters.phoneNumberFormatter).toHaveBeenCalledWith({
        value: '1234567890'
      })
      expect(formatters.phoneNumberFormatter).toHaveBeenCalledWith({
        value: '0987654321'
      })
    })

    test('renders status using StatusRenderer', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockUser} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(cellRenderers.StatusRenderer).toHaveBeenCalledWith({
        data: mockUser,
        isView: true
      })
      expect(screen.getByText('Status: Active')).toBeInTheDocument()
    })

    test('renders roles using RoleSpanRenderer', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockUser} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(cellRenderers.RoleSpanRenderer).toHaveBeenCalledWith({
        data: mockUser
      })
      expect(screen.getByText('administrator, user')).toBeInTheDocument()
    })

    test('displays all form field labels', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockUser} />, [
        query,
        theme,
        localization,
        router
      ])

      // Use data-test attributes to verify structure instead of text content
      const typographyElements = screen.getAllByTestId('bc-typography')
      expect(typographyElements.length).toBe(8) // Should have 8 typography elements for the 8 fields
    })
  })

  describe('Government User Handling', () => {
    test('displays government organization for users without organization', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockGovernmentUser} />, [
        query,
        theme,
        localization,
        router
      ])

      // Look for the govOrg text which should be rendered when organization is null
      expect(screen.getByText('govOrg')).toBeInTheDocument()
    })

    test('renders government user information correctly', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockGovernmentUser} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('Government Official')).toBeInTheDocument()
      expect(screen.getByText('jane.smith@gov.bc.ca')).toBeInTheDocument()
    })

    test('uses organization name when available', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockUser} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(screen.getByText('Test Organization')).toBeInTheDocument()
    })
  })

  describe('Missing Data Handling', () => {
    test('handles missing title gracefully', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const userWithoutTitle = { ...mockUser, title: undefined }
      render(<UserProfile data={userWithoutTitle} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName === 'STRONG' && content.includes('admin:Title')
          )
        })
      ).toBeInTheDocument()
      // Should not throw error
    })

    test('handles missing phone numbers gracefully', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const userWithoutPhones = {
        ...mockUser,
        phone: undefined,
        mobilePhone: undefined
      }

      render(<UserProfile data={userWithoutPhones} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(formatters.phoneNumberFormatter).toHaveBeenCalledWith({
        value: undefined
      })
    })

    test('handles missing email gracefully', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const userWithoutEmail = { ...mockUser, keycloakEmail: undefined }
      render(<UserProfile data={userWithoutEmail} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName === 'STRONG' && content.includes('admin:Email')
          )
        })
      ).toBeInTheDocument()
      // Should not throw error
    })

    test('handles empty roles array', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const userWithoutRoles = { ...mockUser, roles: [] }
      render(<UserProfile data={userWithoutRoles} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(cellRenderers.RoleSpanRenderer).toHaveBeenCalledWith({
        data: userWithoutRoles
      })
    })

    test('handles partially undefined data properties', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const partialData = {
        firstName: 'John',
        lastName: undefined,
        title: 'Developer',
        keycloakEmail: 'john@example.com'
      }

      render(<UserProfile data={partialData} />, [
        query,
        theme,
        localization,
        router
      ])

      // Should render what's available
      expect(screen.getByText('John')).toBeInTheDocument()
      expect(screen.getByText('Developer')).toBeInTheDocument()
      expect(screen.getByText('john@example.com')).toBeInTheDocument()
    })
  })

  describe('Translation Keys', () => {
    test('uses correct translation keys for labels', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockUser} />, [
        query,
        theme,
        localization,
        router
      ])

      // Use more flexible text matching for labels that are inside strong tags
      expect(
        screen.getByText((content, element) => {
          return element?.tagName === 'STRONG' && content.includes('Name')
        })
      ).toBeInTheDocument()

      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName === 'STRONG' && content.includes('admin:Title')
          )
        })
      ).toBeInTheDocument()

      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName === 'STRONG' && content.includes('Organization')
          )
        })
      ).toBeInTheDocument()

      expect(
        screen.getByText((content, element) => {
          return element?.tagName === 'STRONG' && content.includes('Status')
        })
      ).toBeInTheDocument()

      expect(
        screen.getByText((content, element) => {
          return element?.tagName === 'STRONG' && content.includes('Roles')
        })
      ).toBeInTheDocument()

      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName === 'STRONG' && content.includes('admin:Email')
          )
        })
      ).toBeInTheDocument()

      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName === 'STRONG' && content.includes('admin:WorkPhone')
          )
        })
      ).toBeInTheDocument()

      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName === 'STRONG' &&
            content.includes('admin:MobilePhone')
          )
        })
      ).toBeInTheDocument()
    })
  })

  describe('Grid Layout', () => {
    test('renders with proper grid structure', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockUser} />, [
        query,
        theme,
        localization,
        router
      ])

      const gridElements = screen.getAllByTestId('bc-box')
      expect(gridElements.length).toBeGreaterThan(0)
    })

    test('applies correct typography variants', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockUser} />, [
        query,
        theme,
        localization,
        router
      ])

      const typographyElements = screen.getAllByTestId('bc-typography')
      typographyElements.forEach((element) => {
        expect(element).toHaveAttribute('data-variant', 'body4')
      })
    })
  })

  describe('Formatter Function Calls', () => {
    test('calls formatters only when data is available', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockUser} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(formatters.phoneNumberFormatter).toHaveBeenCalledTimes(2)
    })

    test('calls cell renderers with correct data', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockUser} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(cellRenderers.StatusRenderer).toHaveBeenCalledTimes(1)
      expect(cellRenderers.RoleSpanRenderer).toHaveBeenCalledTimes(1)
    })
  })

  describe('Component Structure', () => {
    test('renders main container with correct padding', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockUser} />, [
        query,
        theme,
        localization,
        router
      ])

      const containers = screen.getAllByTestId('bc-box')
      expect(containers[0]).toHaveAttribute('p', '1')
    })

    test('renders grid with responsive columns', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockUser} />, [
        query,
        theme,
        localization,
        router
      ])

      // Check for grid template columns prop
      const gridContainer = screen.getAllByTestId('bc-box')[1]
      expect(gridContainer).toHaveAttribute('display', 'grid')
    })

    test('renders left and right column containers', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockUser} />, [
        query,
        theme,
        localization,
        router
      ])

      const flexContainers = screen
        .getAllByTestId('bc-box')
        .filter((box) => box.getAttribute('display') === 'flex')
      expect(flexContainers.length).toBe(2) // Left and right columns
    })

    test('renders correct number of typography elements', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockUser} />, [
        query,
        theme,
        localization,
        router
      ])

      const typographyElements = screen.getAllByTestId('bc-typography')
      expect(typographyElements.length).toBe(8) // 8 fields total
    })

    test('renders basic structure even with minimal data', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const minimalData = { firstName: 'Test' }
      render(<UserProfile data={minimalData} />, [
        query,
        theme,
        localization,
        router
      ])

      // Should still render the basic grid structure
      const boxes = screen.getAllByTestId('bc-box')
      expect(boxes.length).toBeGreaterThanOrEqual(3) // Main container + grid + columns

      const typographies = screen.getAllByTestId('bc-typography')
      expect(typographies.length).toBe(8) // Should still render all 8 field containers
    })

    test('renders structure even with completely empty data', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={{}} />, [query, theme, localization, router])

      // Should render basic structure regardless of data
      const boxes = screen.getAllByTestId('bc-box')
      expect(boxes.length).toBeGreaterThanOrEqual(3)

      const typographies = screen.getAllByTestId('bc-typography')
      expect(typographies.length).toBe(8)
    })
  })

  describe('Data Properties Access', () => {
    test('safely accesses nested organization properties', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const userWithoutOrg = { ...mockUser, organization: undefined }
      render(<UserProfile data={userWithoutOrg} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(screen.getByText('govOrg')).toBeInTheDocument()
    })

    test('handles organization name correctly', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<UserProfile data={mockUser} />, [
        query,
        theme,
        localization,
        router
      ])

      expect(screen.getByText('Test Organization')).toBeInTheDocument()
    })

    test('safely renders when data object has missing firstName', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const userWithoutFirstName = {
        ...mockUser,
        firstName: undefined,
        lastName: 'Doe'
      }
      render(<UserProfile data={userWithoutFirstName} />, [
        query,
        theme,
        localization,
        router
      ])

      // Should render lastName even if firstName is missing
      expect(
        screen.getByText((content) => content.includes('Doe'))
      ).toBeInTheDocument()
    })

    test('safely renders when data object has missing lastName', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const userWithoutLastName = {
        ...mockUser,
        firstName: 'John',
        lastName: undefined
      }
      render(<UserProfile data={userWithoutLastName} />, [
        query,
        theme,
        localization,
        router
      ])

      // Should render firstName even if lastName is missing
      expect(
        screen.getByText((content) => content.includes('John'))
      ).toBeInTheDocument()
    })

    test('handles completely empty data object', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const emptyData = {}
      render(<UserProfile data={emptyData} />, [
        query,
        theme,
        localization,
        router
      ])

      // Should not crash and should render basic structure
      const containers = screen.getAllByTestId('bc-box')
      expect(containers.length).toBeGreaterThan(0)
    })
  })
})
