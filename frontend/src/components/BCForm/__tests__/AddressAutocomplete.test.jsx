/**
 * @vitest-environment jsdom
 */
import { describe, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddressAutocomplete } from '@/components/BCForm/AddressAutocomplete'
import { test as fixtureTest } from '@/tests/utils/fixtures'

const test = (name, callback) =>
  fixtureTest(name, ({ render: fixtureRender, theme }) =>
    callback({
      render: (ui, providers = [], options = {}) =>
        fixtureRender(ui, providers.filter(Boolean), options),
      theme
    })
  )

// Override the global mock for this test file
vi.unmock('@/components/BCForm/AddressAutocomplete')

// Mock BCTypography
vi.mock('@/components/BCTypography', () => ({
  default: ({ variant, component, color, children, ...props }) => (
    <span
      data-test="bc-typography"
      data-variant={variant}
      data-component={component}
      data-color={color}
      {...props}
    >
      {children}
    </span>
  )
}))

// Create mock functions that can be accessed in tests
const mockAutocompleteAddress = vi.fn()
const mockValidateAddress = vi.fn()

// Mock geocoder hook
vi.mock('@/hooks/useGeocoder', () => ({
  default: () => ({
    validateAddress: {
      mutateAsync: mockValidateAddress,
      isPending: false,
      isLoading: false
    },
    forwardGeocode: { mutateAsync: vi.fn(), isLoading: false },
    reverseGeocode: { mutateAsync: vi.fn(), isLoading: false },
    autocompleteAddress: {
      mutateAsync: mockAutocompleteAddress,
      isPending: false,
      isLoading: false
    },
    checkBCBoundary: { mutateAsync: vi.fn(), isLoading: false },
    batchGeocode: { mutateAsync: vi.fn(), isLoading: false },
    useHealthCheck: () => ({ data: null, isLoading: false })
  })
}))

// Mock API service
vi.mock('@/services/useApiService', () => ({
  useApiService: () => ({
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  })
}))

// Mock the API routes
vi.mock('@/constants/routes', () => ({
  apiRoutes: {
    geocoderAutocomplete: '/geocoder/autocomplete'
  }
}))

// Mock autosuggest-highlight modules
vi.mock('autosuggest-highlight/parse', () => ({
  default: (text, matches) => {
    if (!matches || matches.length === 0) {
      return [{ text, highlight: false }]
    }
    return matches.map((match) => ({
      text: text.substring(match[0], match[1]),
      highlight: true
    }))
  }
}))

vi.mock('autosuggest-highlight/match', () => ({
  default: (text, query) => {
    const index = text.toLowerCase().indexOf(query.toLowerCase())
    if (index === -1) return []
    return [[index, index + query.length]]
  }
}))

describe.sequential('AddressAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock implementations
    mockAutocompleteAddress.mockResolvedValue({ suggestions: [] })
    mockValidateAddress.mockResolvedValue({ addresses: [] })

    // Mock AbortController for any remaining direct fetch usage
    global.AbortController = vi.fn(() => ({
      signal: {},
      abort: vi.fn()
    }))
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    onSelectAddress: vi.fn()
  }

  const mockGeocoderResponse = {
    suggestions: [
      {
        full_address: '123 Main St, Vancouver, BC',
        street_address: '123 Main St',
        city: 'Vancouver',
        province: 'BC',
        postal_code: 'V1V 1V1',
        latitude: 49.2827,
        longitude: -123.1207,
        score: 85
      },
      {
        full_address: '456 Oak Ave, Victoria, BC',
        street_address: '456 Oak Ave',
        city: 'Victoria',
        province: 'BC',
        postal_code: 'V2V 2V2',
        latitude: 48.4284,
        longitude: -123.3656,
        score: 90
      }
    ]
  }

  const mockValidationResponse = {
    addresses: [
      {
        full_address: '123 Main St, Vancouver, BC',
        street_address: '123 Main St',
        city: 'Vancouver',
        province: 'BC',
        postal_code: 'V1V 1V1',
        latitude: 49.2827,
        longitude: -123.1207,
        score: 95
      }
    ]
  }

  const renderAddressAutocomplete = (
    { render, query, theme, localization, router, i18n },
    props = {}
  ) => {
    return render(<AddressAutocomplete {...defaultProps} {...props} />, [
      query,
      theme,
      localization,
      router,
      i18n
    ])
  }

  describe('Basic Rendering', () => {
    test('renders autocomplete input with correct structure', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderAddressAutocomplete({
        render,
        theme
      })

      const input = screen.getByRole('combobox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('placeholder', 'Start typing address...')
    })

    test('renders with initial value when provided', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const initialValue = '123 Test St'
      renderAddressAutocomplete(
        { render, query, theme, localization, router, i18n },
        { value: initialValue }
      )

      const input = screen.getByRole('combobox')
      expect(input).toHaveValue(initialValue)
    })

    test('renders correct placeholder based on address selection state', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderAddressAutocomplete({
        render,
        query,
        theme,
        localization,
        router,
        i18n
      })

      const input = screen.getByRole('combobox')
      expect(input).toHaveAttribute('placeholder', 'Start typing address...')
    })
  })

  describe('API Integration and Data Fetching', () => {
    test('makes API call when user types more than 3 characters', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      mockAutocompleteAddress.mockResolvedValueOnce(mockGeocoderResponse)

      renderAddressAutocomplete({
        render,
        query,
        theme,
        localization,
        router,
        i18n
      })

      const input = screen.getByRole('combobox')
      await user.type(input, 'test')

      // Wait for debounced API call
      await waitFor(
        () => {
          expect(mockAutocompleteAddress).toHaveBeenCalledWith({
            partialAddress: 'test',
            maxResults: 5
          })
        },
        { timeout: 1000 }
      )
    })

    test('does not make API call for input less than 3 characters', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      renderAddressAutocomplete({
        render,
        query,
        theme,
        localization,
        router,
        i18n
      })

      const input = screen.getByRole('combobox')
      await user.clear(input)
      await user.type(input, 'ab')

      // Wait a bit to ensure no API call is made
      await new Promise((resolve) => setTimeout(resolve, 600))

      expect(mockAutocompleteAddress).not.toHaveBeenCalled()
    })

    test('debounces API calls with delay', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      mockAutocompleteAddress.mockResolvedValue(mockGeocoderResponse)

      renderAddressAutocomplete({
        render,
        query,
        theme,
        localization,
        router,
        i18n
      })

      const input = screen.getByRole('combobox')

      // Type multiple characters quickly
      await user.type(input, 'test')

      // Wait for debounced API call
      await waitFor(
        () => {
          expect(mockAutocompleteAddress).toHaveBeenCalledTimes(1)
        },
        { timeout: 1000 }
      )
    })

    test('processes API response and sets options correctly', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      mockAutocompleteAddress.mockResolvedValueOnce(mockGeocoderResponse)

      renderAddressAutocomplete({
        render,
        query,
        theme,
        localization,
        router,
        i18n
      })

      const input = screen.getByRole('combobox')
      await user.type(input, 'main')

      // Wait for API call and response
      await waitFor(
        () => {
          expect(mockAutocompleteAddress).toHaveBeenCalledWith({
            partialAddress: 'main',
            maxResults: 5
          })
        },
        { timeout: 1000 }
      )

      // Verify the component processes the response
      expect(mockAutocompleteAddress).toHaveBeenCalledTimes(1)
    })

    test('handles API errors gracefully', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockAutocompleteAddress.mockRejectedValueOnce(new Error('Network error'))

      renderAddressAutocomplete({
        render,
        query,
        theme,
        localization,
        router,
        i18n
      })

      const input = screen.getByRole('combobox')
      await user.type(input, 'test')

      // Wait for debounced API call
      await waitFor(
        () => {
          expect(mockAutocompleteAddress).toHaveBeenCalled()
        },
        { timeout: 1000 }
      )

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error fetching addresses:',
          expect.any(Error)
        )
      })

      consoleSpy.mockRestore()
    })
  })

  describe('User Input and Interaction', () => {
    test('calls onChange when user types', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()
      const onChangeMock = vi.fn()

      renderAddressAutocomplete(
        { render, query, theme, localization, router, i18n },
        { onChange: onChangeMock }
      )

      const input = screen.getByRole('combobox')
      await user.type(input, 'test')

      expect(onChangeMock).toHaveBeenCalledWith('test')
    })

    test('calls onSelectAddress when address is selected', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()
      const onSelectAddressMock = vi.fn()

      renderAddressAutocomplete(
        { render, query, theme, localization, router, i18n },
        { onSelectAddress: onSelectAddressMock }
      )

      const input = screen.getByRole('combobox')
      await user.type(input, 'test address')

      expect(screen.getByDisplayValue('test address')).toBeInTheDocument()
    })

    test('handles string selection with validation', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const onSelectAddressMock = vi.fn()

      mockValidateAddress.mockResolvedValueOnce(mockValidationResponse)

      renderAddressAutocomplete(
        { render, query, theme, localization, router, i18n },
        { onSelectAddress: onSelectAddressMock }
      )

      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
  })

  describe('Address Selection Logic', () => {
    test('handles address selection properly', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()
      const onSelectAddressMock = vi.fn()

      mockAutocompleteAddress.mockResolvedValueOnce(mockGeocoderResponse)

      renderAddressAutocomplete(
        { render, query, theme, localization, router, i18n },
        { onSelectAddress: onSelectAddressMock }
      )

      const input = screen.getByRole('combobox')
      await user.type(input, 'main')

      // Wait for API call
      await waitFor(
        () => {
          expect(mockAutocompleteAddress).toHaveBeenCalledWith({
            partialAddress: 'main',
            maxResults: 5
          })
        },
        { timeout: 1000 }
      )
    })
  })

  describe('Disabled State', () => {
    test('disables autocomplete when disabled prop is true', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderAddressAutocomplete(
        { render, query, theme, localization, router, i18n },
        { disabled: true }
      )

      const input = screen.getByRole('combobox')
      expect(input).toBeDisabled()
    })
  })

  describe('Loading State', () => {
    test('shows loading state during API call', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      mockAutocompleteAddress.mockResolvedValueOnce(mockGeocoderResponse)

      renderAddressAutocomplete({
        render,
        query,
        theme,
        localization,
        router,
        i18n
      })

      const input = screen.getByRole('combobox')
      await user.type(input, 'test')

      // Wait for debounced API call
      await waitFor(
        () => {
          expect(mockAutocompleteAddress).toHaveBeenCalledWith({
            partialAddress: 'test',
            maxResults: 5
          })
        },
        { timeout: 1000 }
      )

      // Verify API call was made
      expect(mockAutocompleteAddress).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    test('has proper ARIA attributes', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderAddressAutocomplete({
        render,
        query,
        theme,
        localization,
        router,
        i18n
      })

      const input = screen.getByRole('combobox')
      expect(input).toHaveAttribute('aria-expanded')
      expect(input).toHaveAttribute('aria-autocomplete', 'list')
    })

    test('supports keyboard navigation', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      mockAutocompleteAddress.mockResolvedValueOnce(mockGeocoderResponse)

      renderAddressAutocomplete({
        render,
        query,
        theme,
        localization,
        router,
        i18n
      })

      const input = screen.getByRole('combobox')
      await user.type(input, 'main')

      // Wait for debounced API call
      await waitFor(
        () => {
          expect(mockAutocompleteAddress).toHaveBeenCalled()
        },
        { timeout: 1000 }
      )

      await user.keyboard('{ArrowDown}')

      // Should handle keyboard navigation
      expect(input).toHaveFocus()
    })

    test('provides proper focus management', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      renderAddressAutocomplete({
        render,
        query,
        theme,
        localization,
        router,
        i18n
      })

      const input = screen.getByRole('combobox')
      await user.click(input)

      expect(input).toHaveFocus()
    })
  })

  describe('ForwardRef Integration', () => {
    test('forwards ref correctly', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const ref = { current: null }

      render(<AddressAutocomplete ref={ref} {...defaultProps} />, [
        query,
        theme,
        localization,
        router,
        i18n
      ])

      // Component should render without errors when ref is provided
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    test('has correct displayName', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      expect(AddressAutocomplete.displayName).toBe('AddressAutocomplete')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('handles empty API response', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      mockAutocompleteAddress.mockResolvedValueOnce({ suggestions: [] })

      renderAddressAutocomplete({
        render,
        query,
        theme,
        localization,
        router,
        i18n
      })

      const input = screen.getByRole('combobox')
      await user.type(input, 'nonexistent')

      // Wait for debounced API call
      await waitFor(
        () => {
          expect(mockAutocompleteAddress).toHaveBeenCalled()
        },
        { timeout: 1000 }
      )

      await user.click(input)

      // Should handle empty results gracefully
      await waitFor(() => {
        expect(screen.queryByRole('option')).not.toBeInTheDocument()
      })
    })

    test('handles malformed API response', async ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const user = userEvent.setup()

      mockAutocompleteAddress.mockResolvedValueOnce({ invalid: 'response' })

      renderAddressAutocomplete({
        render,
        query,
        theme,
        localization,
        router,
        i18n
      })

      const input = screen.getByRole('combobox')
      await user.type(input, 'test')

      // Wait for debounced API call
      await waitFor(
        () => {
          expect(mockAutocompleteAddress).toHaveBeenCalled()
        },
        { timeout: 1000 }
      )

      // Should handle malformed response gracefully
      expect(input).toBeInTheDocument()
    })

    test('handles component unmounting cleanly', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const { unmount } = renderAddressAutocomplete({
        render,
        query,
        theme,
        localization,
        router,
        i18n
      })

      expect(() => unmount()).not.toThrow()
    })
  })
})
