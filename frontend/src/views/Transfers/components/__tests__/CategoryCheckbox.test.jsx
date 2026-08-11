import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { CategoryCheckbox } from '../CategoryCheckbox'
import { test } from '@/tests/utils/fixtures'
import { describe, expect, vi, beforeEach, afterEach } from 'vitest'
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

  test('should render the component', ({ render, theme, i18n }) => {
    useTransfer.mockReturnValue({
      data: {},
      isFetching: false
    })

    render(<CategoryCheckbox />, [theme, i18n])

    expect(screen.getByTestId('category-checkbox')).toBeInTheDocument()
    expect(screen.getByTestId('checkbox')).toBeInTheDocument()
  })

  test('should display A1 as checked when transfer is flagged A1', ({
    render,
    theme,
    i18n
  }) => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: 'A' }, isA1Category: true },
      isFetching: false
    })

    render(<CategoryCheckbox />, [theme, i18n])

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeChecked()
  })

  test('should display A1 as unchecked when transfer is not flagged A1', ({
    render,
    theme,
    i18n
  }) => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: 'A' }, isA1Category: false },
      isFetching: false
    })

    render(<CategoryCheckbox />, [theme, i18n])

    const checkbox = screen.getByTestId('checkbox')
    expect(checkbox).not.toBeChecked()
  })

  test('should confirm and call updateCategory with A1 false when unchecking A1', ({
    render,
    theme,
    i18n
  }) => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: 'A' }, isA1Category: true },
      isFetching: false
    })

    render(<CategoryCheckbox />, [theme, i18n])

    const checkbox = screen.getByTestId('checkbox')
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByText('Yes'))

    expect(mutateMock).toHaveBeenCalledWith({
      category: 'A',
      isA1Category: false
    })
  })

  test('should confirm and call updateCategory with category A when checking A1', ({
    render,
    theme,
    i18n
  }) => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: 'B' }, isA1Category: false },
      isFetching: false
    })

    render(<CategoryCheckbox />, [theme, i18n])

    const checkbox = screen.getByTestId('checkbox')
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByText('Yes'))

    expect(mutateMock).toHaveBeenCalledWith({
      category: 'A',
      isA1Category: true
    })
  })

  test('should clear A1 when selecting category B', ({
    render,
    theme,
    i18n
  }) => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: 'A' }, isA1Category: true },
      isFetching: false
    })

    render(<CategoryCheckbox />, [theme, i18n])

    fireEvent.click(screen.getByTestId('category-radio-B'))
    fireEvent.click(screen.getByText('Yes'))

    expect(mutateMock).toHaveBeenCalledWith({
      category: 'B',
      isA1Category: false
    })
  })

  test('should set loading state appropriately during fetch', ({
    render,
    theme,
    i18n
  }) => {
    useTransfer.mockReturnValue({
      data: {},
      isFetching: false
    })

    render(<CategoryCheckbox />, [theme, i18n])

    expect(setLoadingMock).toHaveBeenCalledWith(false)
  })

  test('should disable the checkbox when isDisabled is true', ({
    render,
    theme,
    i18n
  }) => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: null } },
      isFetching: false
    })

    render(<CategoryCheckbox isDisabled />, [theme, i18n])

    const checkboxWrapper = screen.getByTestId('checkbox')
    const checkboxInput = checkboxWrapper.querySelector(
      'input[type="checkbox"]'
    )

    // Verify the input is indeed disabled
    expect(checkboxInput).toBeDisabled()
  })

  test('should execute onMutate callback and set loading to true', ({
    render,
    theme,
    i18n
  }) => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: null } },
      isFetching: false
    })

    render(<CategoryCheckbox />, [theme, i18n])

    // Call the onMutate callback directly
    onMutateCallback()

    expect(setLoadingMock).toHaveBeenCalledWith(true)
  })

  test('should execute onSuccess callback and invalidate queries', ({
    render,
    theme,
    i18n
  }) => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: null } },
      isFetching: false
    })

    render(<CategoryCheckbox />, [theme, i18n])

    // Call the onSuccess callback directly
    onSuccessCallback()

    expect(invalidateQueriesMock).toHaveBeenCalledWith(['transfer'])
  })

  test('should not call setLoading when isFetching is true', ({
    render,
    theme,
    i18n
  }) => {
    useTransfer.mockReturnValue({
      data: { transferCategory: { category: null } },
      isFetching: true
    })

    render(<CategoryCheckbox />, [theme, i18n])

    // setLoading(false) should not be called when isFetching is true
    expect(setLoadingMock).not.toHaveBeenCalledWith(false)
  })
})
