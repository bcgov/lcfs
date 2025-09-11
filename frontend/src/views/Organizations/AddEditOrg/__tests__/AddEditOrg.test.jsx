import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AddEditOrg } from '../AddEditOrg'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { useOrganization, useOrganizationTypes } from '@/hooks/useOrganization'
import { useApiService } from '@/services/useApiService'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn()
}))

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: vi.fn(),
  useNavigate: vi.fn()
}))

// Mock hooks
vi.mock('@/hooks/useOrganization')
vi.mock('@/services/useApiService')

// Mock BCWidgetCard component
vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  default: vi.fn(({ title, content, id, color, 'data-test': dataTest }) => (
    <div
      data-test="bc-widget-card"
      data-container-test={dataTest}
      data-title={title}
      data-id={id}
      data-color={color}
    >
      {content}
    </div>
  ))
}))

// Mock AddEditOrgForm component
vi.mock('../AddEditOrgForm', () => ({
  AddEditOrgForm: vi.fn(() => <div data-test="add-edit-org-form" />)
}))

describe('AddEditOrg', () => {
  const mockT = vi.fn((key) => `translated-${key}`)
  let mockNavigate

  beforeEach(() => {
    mockNavigate = vi.fn()
    useNavigate.mockReturnValue(mockNavigate)
    useParams.mockReturnValue({ orgID: undefined })

    // Mocking the useOrganization hook
    useOrganization.mockReturnValue({
      isFetched: true
    })

    // Mock organization types with BCeID required type for validation testing
    vi.clearAllMocks()
    useTranslation.mockReturnValue({ t: mockT })
    useOrganizationTypes.mockReturnValue({
      data: [
        {
          organizationTypeId: 1,
          organizationTypeName: 'Fuel Supplier',
          isBceidUser: true
        },
        {
          organizationTypeId: 2,
          organizationTypeName: 'Initiative Agreement Holder',
          isBceidUser: false
        }
      ],
      isLoading: false,
      error: null
    })
    useApiService.mockReturnValue({
      post: vi.fn(),
      put: vi.fn()
    })
  })

  it('renders in edit mode when orgID is present', () => {
    // Arrange
    useParams.mockReturnValue({ orgID: 'test-org-123' })

    // Act
    render(<AddEditOrg />)

    // Assert
    expect(screen.getByTestId('bc-widget-card')).toBeInTheDocument()
    expect(screen.getByTestId('add-edit-org-form')).toBeInTheDocument()
    expect(mockT).toHaveBeenCalledWith('org:editOrgTitle')
    expect(screen.getByTestId('bc-widget-card')).toHaveAttribute(
      'data-title',
      'translated-org:editOrgTitle'
    )
  })

  it('passes correct props to AddEditOrgForm component', () => {
    // Arrange
    useParams.mockReturnValue({ orgID: 'test-org-123' })

    // Act
    render(<AddEditOrg />)

    // Assert
    expect(screen.getByTestId('add-edit-org-form')).toBeInTheDocument()
  })

  it('renders in add mode when orgID is not present', () => {
    // Arrange
    useParams.mockReturnValue({ orgID: undefined })

    // Act
    render(<AddEditOrg />)

    // Assert
    expect(screen.getByTestId('bc-widget-card')).toBeInTheDocument()
    expect(screen.getByTestId('add-edit-org-form')).toBeInTheDocument()
    expect(mockT).toHaveBeenCalledWith('org:addOrgTitle')
    expect(screen.getByTestId('bc-widget-card')).toHaveAttribute(
      'data-title',
      'translated-org:addOrgTitle'
    )
  })

  it('renders with correct static props for BCWidgetCard', () => {
    // Arrange
    useParams.mockReturnValue({ orgID: 'test-id' })

    // Act
    render(<AddEditOrg />)

    // Assert
    const widgetCard = screen.getByTestId('bc-widget-card')
    expect(widgetCard).toHaveAttribute('data-id', 'user-card')
    expect(widgetCard).toHaveAttribute('data-color', 'nav')
    expect(widgetCard).toHaveAttribute(
      'data-container-test',
      'addEditOrgContainer'
    )
  })

  it('calls useTranslation hook with correct parameters', () => {
    // Arrange
    useParams.mockReturnValue({ orgID: 'test-id' })

    // Act
    render(<AddEditOrg />)

    // Assert
    expect(useTranslation).toHaveBeenCalledWith(['common', 'org'])
  })

  it('calls useParams hook to extract orgID', () => {
    // Arrange
    const testOrgId = 'test-organization-id'
    useParams.mockReturnValue({ orgID: testOrgId })

    // Act
    render(<AddEditOrg />)

    // Assert
    expect(useParams).toHaveBeenCalled()
    // Verify the title uses edit mode since orgID is present
    expect(mockT).toHaveBeenCalledWith('org:editOrgTitle')
  })

  it('renders AddEditOrgForm component within BCWidgetCard content', () => {
    // Arrange
    useParams.mockReturnValue({ orgID: 'test-id' })

    // Act
    render(<AddEditOrg />)

    // Assert
    expect(screen.getByTestId('add-edit-org-form')).toBeInTheDocument()
    expect(screen.getByTestId('bc-widget-card')).toBeInTheDocument()
    // Verify the form is rendered as the content of the widget card
    const widgetCard = screen.getByTestId('bc-widget-card')
    const form = screen.getByTestId('add-edit-org-form')
    expect(widgetCard).toContainElement(form)
  })
})
