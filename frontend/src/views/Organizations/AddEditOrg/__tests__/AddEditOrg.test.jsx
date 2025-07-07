import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddEditOrgForm } from '../AddEditOrgForm'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useOrganization } from '@/hooks/useOrganization'
import { useApiService } from '@/services/useApiService'
import { ROUTES } from '@/routes/routes'
import { useNavigate, useParams } from 'react-router-dom'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('@/hooks/useOrganization')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))
vi.mock('@/services/useApiService')
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
  useParams: vi.fn()
}))

// Simple mock for react-query
vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false
  }))
}))

const mockedOrg = {
  name: 'Test Org',
  operatingName: 'Test Operating Org',
  email: 'test@example.com',
  phone: '123-456-7890',
  edrmsRecord: 'EDRMS123',
  recordsAddress: '789 Test St, City, Province, A1B2C3',
  orgAddress: {
    streetAddress: '123 Test St',
    addressOther: '',
    city: 'Test City',
    postalcodeZipcode: 'A1B2C3'
  },
  orgAttorneyAddress: {
    streetAddress: '456 Attorney Rd',
    addressOther: '',
    city: 'Attorney City',
    postalcodeZipcode: 'D4E5F6',
    provinceState: 'BC',
    country: 'Canada'
  },
  orgStatus: { organizationStatusId: 2 }
}

describe('AddEditOrg', () => {
  let mockNavigate
  let apiSpy

  beforeEach(() => {
    mockNavigate = vi.fn()
    useNavigate.mockReturnValue(mockNavigate)
    useParams.mockReturnValue({ orgID: undefined })

    useOrganization.mockReturnValue({
      data: undefined,
      isFetched: true
    })

    apiSpy = {
      post: vi.fn(),
      put: vi.fn()
    }
    useApiService.mockReturnValue(apiSpy)
  })

  it('renders the form', () => {
    render(<AddEditOrgForm />, { wrapper })

    expect(screen.getByTestId('addEditOrgContainer')).toBeInTheDocument()
  })
})
