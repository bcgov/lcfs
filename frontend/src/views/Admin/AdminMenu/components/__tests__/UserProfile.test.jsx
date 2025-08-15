import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { wrapper } from '@/tests/utils/wrapper'
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
    it('renders user basic information correctly', () => {
      render(<UserProfile data={mockUser} />, { wrapper })

      // Look for user data that should be rendered as plain text
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Software Developer')).toBeInTheDocument()
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument()
      expect(screen.getByText('Test Organization')).toBeInTheDocument()
    })

    it('renders user names with space between first and last name', () => {
      render(<UserProfile data={mockUser} />, { wrapper })

      // Check that first and last names are rendered together
      expect(
        screen.getByText(
          (content) => content.includes('John') && content.includes('Doe')
        )
      ).toBeInTheDocument()
    })

    it('renders formatted phone numbers', () => {
      render(<UserProfile data={mockUser} />, { wrapper })

      expect(screen.getByText('(123) 456-7890')).toBeInTheDocument()
      expect(screen.getByText('(098) 765-4321')).toBeInTheDocument()
    })

    it('calls phone number formatter with correct parameters', () => {
      render(<UserProfile data={mockUser} />, { wrapper })

      expect(formatters.phoneNumberFormatter).toHaveBeenCalledWith({
        value: '1234567890'
      })
      expect(formatters.phoneNumberFormatter).toHaveBeenCalledWith({
        value: '0987654321'
      })
    })

    it('renders status using StatusRenderer', () => {
      render(<UserProfile data={mockUser} />, { wrapper })

      expect(cellRenderers.StatusRenderer).toHaveBeenCalledWith({
        data: mockUser,
        isView: true
      })
      expect(screen.getByText('Status: Active')).toBeInTheDocument()
    })

    it('renders roles using RoleSpanRenderer', () => {
      render(<UserProfile data={mockUser} />, { wrapper })

      expect(cellRenderers.RoleSpanRenderer).toHaveBeenCalledWith({
        data: mockUser
      })
      expect(screen.getByText('administrator, user')).toBeInTheDocument()
    })

    it('displays all form field labels', () => {
      render(<UserProfile data={mockUser} />, { wrapper })

      // Use data-test attributes to verify structure instead of text content
      const typographyElements = screen.getAllByTestId('bc-typography')
      expect(typographyElements.length).toBe(8) // Should have 8 typography elements for the 8 fields
    })
  })

  describe('Government User Handling', () => {
    it('displays government organization for users without organization', () => {
      render(<UserProfile data={mockGovernmentUser} />, { wrapper })

      // Look for the govOrg text which should be rendered when organization is null
      expect(screen.getByText('govOrg')).toBeInTheDocument()
    })

    it('renders government user information correctly', () => {
      render(<UserProfile data={mockGovernmentUser} />, { wrapper })

      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('Government Official')).toBeInTheDocument()
      expect(screen.getByText('jane.smith@gov.bc.ca')).toBeInTheDocument()
    })

    it('uses organization name when available', () => {
      render(<UserProfile data={mockUser} />, { wrapper })

      expect(screen.getByText('Test Organization')).toBeInTheDocument()
    })
  })

  describe('Missing Data Handling', () => {
    it('handles missing title gracefully', () => {
      const userWithoutTitle = { ...mockUser, title: undefined }
      render(<UserProfile data={userWithoutTitle} />, { wrapper })

      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName === 'STRONG' && content.includes('admin:Title')
          )
        })
      ).toBeInTheDocument()
      // Should not throw error
    })

    it('handles missing phone numbers gracefully', () => {
      const userWithoutPhones = {
        ...mockUser,
        phone: undefined,
        mobilePhone: undefined
      }

      render(<UserProfile data={userWithoutPhones} />, { wrapper })

      expect(formatters.phoneNumberFormatter).toHaveBeenCalledWith({
        value: undefined
      })
    })

    it('handles missing email gracefully', () => {
      const userWithoutEmail = { ...mockUser, keycloakEmail: undefined }
      render(<UserProfile data={userWithoutEmail} />, { wrapper })

      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName === 'STRONG' && content.includes('admin:Email')
          )
        })
      ).toBeInTheDocument()
      // Should not throw error
    })

    it('handles empty roles array', () => {
      const userWithoutRoles = { ...mockUser, roles: [] }
      render(<UserProfile data={userWithoutRoles} />, { wrapper })

      expect(cellRenderers.RoleSpanRenderer).toHaveBeenCalledWith({
        data: userWithoutRoles
      })
    })

    it('handles partially undefined data properties', () => {
      const partialData = {
        firstName: 'John',
        lastName: undefined,
        title: 'Developer',
        keycloakEmail: 'john@example.com'
      }

      render(<UserProfile data={partialData} />, { wrapper })

      // Should render what's available
      expect(screen.getByText('John')).toBeInTheDocument()
      expect(screen.getByText('Developer')).toBeInTheDocument()
      expect(screen.getByText('john@example.com')).toBeInTheDocument()
    })
  })

  describe('Translation Keys', () => {
    it('uses correct translation keys for labels', () => {
      render(<UserProfile data={mockUser} />, { wrapper })

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
    it('renders with proper grid structure', () => {
      render(<UserProfile data={mockUser} />, { wrapper })

      const gridElements = screen.getAllByTestId('bc-box')
      expect(gridElements.length).toBeGreaterThan(0)
    })

    it('applies correct typography variants', () => {
      render(<UserProfile data={mockUser} />, { wrapper })

      const typographyElements = screen.getAllByTestId('bc-typography')
      typographyElements.forEach((element) => {
        expect(element).toHaveAttribute('data-variant', 'body4')
      })
    })
  })

  describe('Formatter Function Calls', () => {
    it('calls formatters only when data is available', () => {
      render(<UserProfile data={mockUser} />, { wrapper })

      expect(formatters.phoneNumberFormatter).toHaveBeenCalledTimes(2)
    })

    it('calls cell renderers with correct data', () => {
      render(<UserProfile data={mockUser} />, { wrapper })

      expect(cellRenderers.StatusRenderer).toHaveBeenCalledTimes(1)
      expect(cellRenderers.RoleSpanRenderer).toHaveBeenCalledTimes(1)
    })
  })

  describe('Component Structure', () => {
    it('renders main container with correct padding', () => {
      render(<UserProfile data={mockUser} />, { wrapper })

      const containers = screen.getAllByTestId('bc-box')
      expect(containers[0]).toHaveAttribute('p', '1')
    })

    it('renders grid with responsive columns', () => {
      render(<UserProfile data={mockUser} />, { wrapper })

      // Check for grid template columns prop
      const gridContainer = screen.getAllByTestId('bc-box')[1]
      expect(gridContainer).toHaveAttribute('display', 'grid')
    })

    it('renders left and right column containers', () => {
      render(<UserProfile data={mockUser} />, { wrapper })

      const flexContainers = screen
        .getAllByTestId('bc-box')
        .filter((box) => box.getAttribute('display') === 'flex')
      expect(flexContainers.length).toBe(2) // Left and right columns
    })

    it('renders correct number of typography elements', () => {
      render(<UserProfile data={mockUser} />, { wrapper })

      const typographyElements = screen.getAllByTestId('bc-typography')
      expect(typographyElements.length).toBe(8) // 8 fields total
    })

    it('renders basic structure even with minimal data', () => {
      const minimalData = { firstName: 'Test' }
      render(<UserProfile data={minimalData} />, { wrapper })

      // Should still render the basic grid structure
      const boxes = screen.getAllByTestId('bc-box')
      expect(boxes.length).toBeGreaterThanOrEqual(3) // Main container + grid + columns

      const typographies = screen.getAllByTestId('bc-typography')
      expect(typographies.length).toBe(8) // Should still render all 8 field containers
    })

    it('renders structure even with completely empty data', () => {
      render(<UserProfile data={{}} />, { wrapper })

      // Should render basic structure regardless of data
      const boxes = screen.getAllByTestId('bc-box')
      expect(boxes.length).toBeGreaterThanOrEqual(3)

      const typographies = screen.getAllByTestId('bc-typography')
      expect(typographies.length).toBe(8)
    })
  })

  describe('Data Properties Access', () => {
    it('safely accesses nested organization properties', () => {
      const userWithoutOrg = { ...mockUser, organization: undefined }
      render(<UserProfile data={userWithoutOrg} />, { wrapper })

      expect(screen.getByText('govOrg')).toBeInTheDocument()
    })

    it('handles organization name correctly', () => {
      render(<UserProfile data={mockUser} />, { wrapper })

      expect(screen.getByText('Test Organization')).toBeInTheDocument()
    })

    it('safely renders when data object has missing firstName', () => {
      const userWithoutFirstName = {
        ...mockUser,
        firstName: undefined,
        lastName: 'Doe'
      }
      render(<UserProfile data={userWithoutFirstName} />, { wrapper })

      // Should render lastName even if firstName is missing
      expect(
        screen.getByText((content) => content.includes('Doe'))
      ).toBeInTheDocument()
    })

    it('safely renders when data object has missing lastName', () => {
      const userWithoutLastName = {
        ...mockUser,
        firstName: 'John',
        lastName: undefined
      }
      render(<UserProfile data={userWithoutLastName} />, { wrapper })

      // Should render firstName even if lastName is missing
      expect(
        screen.getByText((content) => content.includes('John'))
      ).toBeInTheDocument()
    })

    it('handles completely empty data object', () => {
      const emptyData = {}
      render(<UserProfile data={emptyData} />, { wrapper })

      // Should not crash and should render basic structure
      const containers = screen.getAllByTestId('bc-box')
      expect(containers.length).toBeGreaterThan(0)
    })
  })
})
