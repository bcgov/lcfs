import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { CategoryCheckbox } from '../CategoryCheckbox'
import { wrapper } from '@/tests/utils/wrapper'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useTransfer, useUpdateCategory } from '@/hooks/useTransfer'
import { useLoadingStore } from '@/stores/useLoadingStore'

const keycloak = vi.hoisted(() => ({
  useKeycloak: vi.fn(),
}))

vi.mock('@react-keycloak/web', () => keycloak)

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ transferId: '123' }),
  }
})

vi.mock('@/hooks/useTransfer', () => ({
  useTransfer: vi.fn(),
  useUpdateCategory: vi.fn(),
}))

vi.mock('@/stores/useLoadingStore', () => ({
  useLoadingStore: vi.fn(),
}))

describe('CategoryCheckbox Component', () => {
  const setLoadingMock = vi.fn()
  const mutateMock = vi.fn()

  beforeEach(() => {
    keycloak.useKeycloak.mockReturnValue({
      keycloak: { authenticated: true },
      initialized: true,
    })

    // Correctly mock useLoadingStore to handle the selector
    useLoadingStore.mockImplementation((selector) => selector({ setLoading: setLoadingMock }))

    useUpdateCategory.mockReturnValue({
      mutate: mutateMock,
    })

    // Reset mocks
    setLoadingMock.mockReset()
    mutateMock.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should render the component', () => {
    useTransfer.mockReturnValue({
      data: {},
      isFetching: false,
    })

    render(<CategoryCheckbox />, { wrapper })

    expect(screen.getByTestId('category-checkbox')).toBeInTheDocument()
    expect(screen.getByTestId('checkbox')).toBeInTheDocument()
  })

  it('should display the checkbox as checked when category is "D"', () => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: 'D' } },
      isFetching: false,
    })

    render(<CategoryCheckbox />, { wrapper })

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeChecked()
  })

  it('should display the checkbox as unchecked when category is not "D"', () => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: null } },
      isFetching: false,
    })

    render(<CategoryCheckbox />, { wrapper })

    const checkbox = screen.getByTestId('checkbox')
    expect(checkbox).not.toBeChecked()
  })

  it('should call updateCategory with null when unchecking the checkbox', () => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: 'D' } },
      isFetching: false,
    })

    render(<CategoryCheckbox />, { wrapper })

    const checkbox = screen.getByTestId('checkbox')
    fireEvent.click(checkbox)

    expect(mutateMock).toHaveBeenCalledWith(null)
  })

  it('should call updateCategory with "D" when checking the checkbox', () => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: null } },
      isFetching: false,
    })

    render(<CategoryCheckbox />, { wrapper })

    const checkbox = screen.getByTestId('checkbox')
    fireEvent.click(checkbox)

    expect(mutateMock).toHaveBeenCalledWith('D')
  })

  it('should set loading state appropriately during fetch', () => {
    useTransfer.mockReturnValue({
      data: {},
      isFetching: false,
    })

    render(<CategoryCheckbox />, { wrapper })

    expect(setLoadingMock).toHaveBeenCalledWith(false)
  })
})
