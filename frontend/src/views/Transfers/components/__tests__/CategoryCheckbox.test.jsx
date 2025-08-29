import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { CategoryCheckbox } from '../CategoryCheckbox'
import { wrapper } from '@/tests/utils/wrapper'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useTransfer, useUpdateCategory } from '@/hooks/useTransfer'
import { useLoadingStore } from '@/stores/useLoadingStore'
import { useQueryClient } from '@tanstack/react-query'

const keycloak = vi.hoisted(() => ({
  useKeycloak: vi.fn()
}))

vi.mock('@react-keycloak/web', () => keycloak)

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ transferId: '123' })
  }
})

vi.mock('@/hooks/useTransfer', () => ({
  useTransfer: vi.fn(),
  useUpdateCategory: vi.fn()
}))

vi.mock('@/stores/useLoadingStore', () => ({
  useLoadingStore: vi.fn()
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn()
}))

describe('CategoryCheckbox Component', () => {
  const setLoadingMock = vi.fn()
  const mutateMock = vi.fn()
  const invalidateQueriesMock = vi.fn()
  let onMutateCallback, onSuccessCallback

  beforeEach(() => {
    keycloak.useKeycloak.mockReturnValue({
      keycloak: { authenticated: true },
      initialized: true
    })

    // Correctly mock useLoadingStore to handle the selector
    useLoadingStore.mockImplementation((selector) =>
      selector({ setLoading: setLoadingMock })
    )

    // Mock useQueryClient
    vi.mocked(useQueryClient).mockReturnValue({
      invalidateQueries: invalidateQueriesMock
    })

    // Mock updateCategory hook and capture callbacks
    useUpdateCategory.mockImplementation((transferId, options) => {
      onMutateCallback = options.onMutate
      onSuccessCallback = options.onSuccess
      return {
        mutate: mutateMock
      }
    })

    // Reset mocks
    setLoadingMock.mockReset()
    mutateMock.mockReset()
    invalidateQueriesMock.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should render the component', () => {
    useTransfer.mockReturnValue({
      data: {},
      isFetching: false
    })

    render(<CategoryCheckbox />, { wrapper })

    expect(screen.getByTestId('category-checkbox')).toBeInTheDocument()
    expect(screen.getByTestId('checkbox')).toBeInTheDocument()
  })

  it('should display the checkbox as checked when category is "D"', () => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: 'D' } },
      isFetching: false
    })

    render(<CategoryCheckbox />, { wrapper })

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeChecked()
  })

  it('should display the checkbox as unchecked when category is not "D"', () => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: null } },
      isFetching: false
    })

    render(<CategoryCheckbox />, { wrapper })

    const checkbox = screen.getByTestId('checkbox')
    expect(checkbox).not.toBeChecked()
  })

  it('should call updateCategory with null when unchecking the checkbox', () => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: 'D' } },
      isFetching: false
    })

    render(<CategoryCheckbox />, { wrapper })

    const checkbox = screen.getByTestId('checkbox')
    fireEvent.click(checkbox)

    expect(mutateMock).toHaveBeenCalledWith(null)
  })

  it('should call updateCategory with "D" when checking the checkbox', () => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: null } },
      isFetching: false
    })

    render(<CategoryCheckbox />, { wrapper })

    const checkbox = screen.getByTestId('checkbox')
    fireEvent.click(checkbox)

    expect(mutateMock).toHaveBeenCalledWith('D')
  })

  it('should set loading state appropriately during fetch', () => {
    useTransfer.mockReturnValue({
      data: {},
      isFetching: false
    })

    render(<CategoryCheckbox />, { wrapper })

    expect(setLoadingMock).toHaveBeenCalledWith(false)
  })

  it('should disable the checkbox when isDisabled is true', () => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: null } },
      isFetching: false
    })

    render(<CategoryCheckbox isDisabled />, { wrapper })

    const checkboxWrapper = screen.getByTestId('checkbox')
    const checkboxInput = checkboxWrapper.querySelector(
      'input[type="checkbox"]'
    )

    // Verify the input is indeed disabled
    expect(checkboxInput).toBeDisabled()
  })

  it('should execute onMutate callback and set loading to true', () => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: null } },
      isFetching: false
    })

    render(<CategoryCheckbox />, { wrapper })

    // Call the onMutate callback directly
    onMutateCallback()

    expect(setLoadingMock).toHaveBeenCalledWith(true)
  })

  it('should execute onSuccess callback and invalidate queries', () => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: null } },
      isFetching: false
    })

    render(<CategoryCheckbox />, { wrapper })

    // Call the onSuccess callback directly
    onSuccessCallback()

    expect(invalidateQueriesMock).toHaveBeenCalledWith(['transfer'])
  })

  it('should not call setLoading when isFetching is true', () => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: null } },
      isFetching: true
    })

    render(<CategoryCheckbox />, { wrapper })

    // setLoading(false) should not be called when isFetching is true
    expect(setLoadingMock).not.toHaveBeenCalledWith(false)
  })
})
