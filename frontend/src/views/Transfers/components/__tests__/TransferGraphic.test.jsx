import React from 'react'
import { render, screen } from '@testing-library/react'
import { TransferGraphic } from '../TransferGraphic'
import { FormProvider, useForm, useFormContext } from 'react-hook-form'
import { vi } from 'vitest'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRegExtOrgs } from '@/hooks/useOrganization'
import { useTransfer } from '@/hooks/useTransfer'
import { wrapper } from '@/tests/utils/wrapper.jsx'

vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useOrganization')
vi.mock('@/hooks/useTransfer')
vi.mock('react-router-dom', () => ({
  useParams: () => ({ transferId: '1' })
}))

vi.mock('react-hook-form', async () => {
  const reactHookForm = await vi.importActual('react-hook-form')

  return {
    ...reactHookForm,
    useFormContext: vi.fn()
  }
})

const MockFormProvider = ({ children }) => {
  const methods = useForm()
  return <FormProvider {...methods}>{children}</FormProvider>
}

describe('TransferGraphic Component', () => {
  beforeEach(() => {
    useFormContext.mockReturnValue({
      watch: vi.fn()
    })
    useCurrentUser.mockReturnValue({
      data: {
        organization: { name: 'Org A' }
      }
    })
    useRegExtOrgs.mockReturnValue({
      data: [
        { organizationId: 1, name: 'Org A' },
        { organizationId: 2, name: 'Org B' }
      ]
    })
    useTransfer.mockReturnValue({
      data: {
        fromOrganization: { name: 'Org A' },
        toOrganization: { name: 'Org B' }
      }
    })
  })

  test('renders correctly with organization name from useTransfer hook', () => {
    render(
      <MockFormProvider>
        <TransferGraphic />
      </MockFormProvider>,
      { wrapper }
    )
    expect(screen.getByText('Org A')).toBeInTheDocument()
  })

  test('displays the correct icon based on quantity and total value', () => {
    render(
      <MockFormProvider>
        <TransferGraphic />
      </MockFormProvider>,
      { wrapper }
    )

    // Initially, quantity and pricePerUnit are not set, so no icon should be rendered
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    // Check for HorizontalRuleIcon when both are invalid
    expect(screen.getByTestId('HorizontalRuleIcon')).toBeInTheDocument()

    // Set Valid Quantity and Total
    useFormContext.mockReturnValue({
      watch: (fieldName) => {
        switch (fieldName) {
          case 'quantity':
            return '5'
          case 'pricePerUnit':
            return '450'
          case 'toOrganizationId':
            return 'fake-org-id'
        }
      }
    })

    // Re-render the component
    render(
      <MockFormProvider>
        <TransferGraphic />
      </MockFormProvider>,
      { wrapper }
    )

    // Check for SyncAltIcon when both quantity and total value are valid
    expect(screen.getByTestId('SyncAltIcon')).toBeInTheDocument()

    // Set Only Valid Total
    useFormContext.mockReturnValue({
      watch: (fieldName) => {
        switch (fieldName) {
          case 'quantity':
            return '10'
          case 'pricePerUnit':
            return null
          case 'toOrganizationId':
            return 'fake-org-id'
        }
      }
    })

    // Re-render the component
    render(
      <MockFormProvider>
        <TransferGraphic />
      </MockFormProvider>,
      { wrapper }
    )

    // Check for TrendingFlatIcon when quantity is valid but total is invalid
    expect(screen.getByTestId('TrendingFlatIcon')).toBeInTheDocument()
  })

  test('displays formatted number of credits and total value correctly', () => {
    // Set values for quantity and pricePerUnit
    useFormContext.mockReturnValue({
      watch: (fieldName) => {
        switch (fieldName) {
          case 'quantity':
            return '10'
          case 'pricePerUnit':
            return '5'
          case 'toOrganizationId':
            return 'fake-org-id'
        }
      }
    })

    // Re-render the component
    render(
      <MockFormProvider>
        <TransferGraphic />
      </MockFormProvider>,
      { wrapper }
    )

    expect(screen.getByText('10 compliance units')).toBeInTheDocument()
    expect(screen.getByText('$50.00')).toBeInTheDocument() // Assuming formatCurrency formats it correctly
  })
})
