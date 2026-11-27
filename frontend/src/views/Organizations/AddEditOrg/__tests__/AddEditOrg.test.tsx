import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vite-plus/test'
import { AddEditOrg } from '../AddEditOrg'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import i18n from '@/i18n'
import '@tanstack/react-query'
import type { AddressAutocompleteProps } from '@/components/BCForm/AddressAutocomplete'
import type { ReactNode } from 'react'
import type { NavigateOptions, To } from 'react-router-dom'

// Mock react-i18next

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn()
}))

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: vi.fn(),
  useNavigate: vi.fn()
}))

// Mock AddressAutocomplete to prevent network requests
vi.mock('@/components/BCForm/AddressAutocomplete', () => ({
  AddressAutocomplete: React.forwardRef<
    HTMLInputElement,
    AddressAutocompleteProps & {
      name?: string
      placeholder?: string
      onBlur?: React.FocusEventHandler<HTMLInputElement>
    }
  >(function AddressAutocompleteMock(
    { name, placeholder = 'Start typing address...', value, onChange, onBlur },
    ref
  ) {
    return (
      <input
        ref={ref}
        id={name}
        name={name}
        placeholder={placeholder}
        value={typeof value === 'string' ? value : value?.fullAddress || ''}
        onChange={(event) => onChange?.(event.target.value)}
        onBlur={onBlur}
        data-testid={`address-autocomplete-${name}`}
        aria-label={name?.includes('street') ? 'org:streetAddrLabel' : name}
      />
    )
  })
}))

// Mock the useMutation hook to properly handle onSuccess callback
const mockMutate = vi.fn()
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useMutation: vi.fn(() => ({
      mutate: mockMutate,
      isPending: false,
      isError: false
    }))
  }
})

// Mock hooks
vi.mock('@/hooks/useOrganization')

// Mock BCWidgetCard component
vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  default: vi.fn(
    ({
      title,
      content,
      id,
      color,
      'data-test': dataTest
    }: {
      title: string
      content: ReactNode
      id: string
      color: string
      'data-test'?: string
    }) => (
      <div
        data-test="bc-widget-card"
        data-container-test={dataTest}
        data-title={title}
        data-id={id}
        data-color={color}
      >
        {content}
      </div>
    )
  )
}))

// Mock AddEditOrgForm component
vi.mock('../AddEditOrgForm', () => ({
  AddEditOrgForm: vi.fn(() => <div data-test="add-edit-org-form" />)
}))

describe('AddEditOrg', () => {
  type TranslationFunction = ReturnType<typeof useTranslation>['t']
  const mockT = vi.fn(
    (key: string) => `translated-${key}`
  ) as unknown as TranslationFunction
  const mockNavigate: ReturnType<typeof useNavigate> = (
    _destination: To | number,
    _options?: NavigateOptions
  ) => {}

  beforeEach(() => {
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)
    vi.mocked(useParams).mockReturnValue({ orgID: undefined })

    vi.clearAllMocks()
    vi.mocked(useTranslation).mockReturnValue(
      Object.assign(
        [mockT, i18n, true] as [TranslationFunction, typeof i18n, boolean],
        {
          t: mockT,
          i18n,
          ready: true
        }
      )
    )
  })

  // Note: Tests for AddEditOrgForm component rendering should be in AddEditOrgForm.test.jsx
  // This test suite tests the AddEditOrg container component only

  it('renders in edit mode when orgID is present', () => {
    // Arrange
    vi.mocked(useParams).mockReturnValue({ orgID: 'test-org-123' })

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
    vi.mocked(useParams).mockReturnValue({ orgID: 'test-org-123' })

    // Act
    render(<AddEditOrg />)

    // Assert
    expect(screen.getByTestId('add-edit-org-form')).toBeInTheDocument()
  })

  it('renders in add mode when orgID is not present', () => {
    // Arrange
    vi.mocked(useParams).mockReturnValue({ orgID: undefined })

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
    vi.mocked(useParams).mockReturnValue({ orgID: 'test-id' })

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
    vi.mocked(useParams).mockReturnValue({ orgID: 'test-id' })

    // Act
    render(<AddEditOrg />)

    // Assert
    expect(useTranslation).toHaveBeenCalledWith(['common', 'org'])
  })

  it('calls useParams hook to extract orgID', () => {
    // Arrange
    const testOrgId = 'test-organization-id'
    vi.mocked(useParams).mockReturnValue({ orgID: testOrgId })

    // Act
    render(<AddEditOrg />)

    // Assert
    expect(useParams).toHaveBeenCalled()
    // Verify the title uses edit mode since orgID is present
    expect(mockT).toHaveBeenCalledWith('org:editOrgTitle')
  })

  it('renders AddEditOrgForm component within BCWidgetCard content', () => {
    // Arrange
    vi.mocked(useParams).mockReturnValue({ orgID: 'test-id' })

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
