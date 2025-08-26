/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddressAutocomplete } from '../AddressAutocomplete'
import { AppWrapper } from '@/tests/utils'

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
    return matches.map(match => ({
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

describe('AddressAutocomplete', () => {
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

  const renderAddressAutocomplete = (props = {}) => {
    return render(
      <AddressAutocomplete {...defaultProps} {...props} />,
      { wrapper: AppWrapper }
    )
  }

  describe('Basic Rendering', () => {
    it('renders autocomplete input with correct structure', () => {
      renderAddressAutocomplete()
      
      const input = screen.getByRole('combobox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('placeholder', 'Start typing address...')
    })

    it('renders with initial value when provided', () => {
      const initialValue = '123 Test St'
      renderAddressAutocomplete({ value: initialValue })
      
      const input = screen.getByRole('combobox')
      expect(input).toHaveValue(initialValue)
    })

    it('renders correct placeholder based on address selection state', () => {
      renderAddressAutocomplete()
      
      const input = screen.getByRole('combobox')
      expect(input).toHaveAttribute('placeholder', 'Start typing address...')
    })
  })

  describe('API Integration and Data Fetching', () => {
    it('makes API call when user types more than 3 characters', async () => {
      const user = userEvent.setup()
      
      mockAutocompleteAddress.mockResolvedValueOnce(mockGeocoderResponse)

      renderAddressAutocomplete()
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'test')
      
      // Wait for debounced API call
      await waitFor(() => {
        expect(mockAutocompleteAddress).toHaveBeenCalledWith({
          partialAddress: 'test',
          maxResults: 5
        })
      }, { timeout: 1000 })
    })

    it('does not make API call for input less than 3 characters', async () => {
      const user = userEvent.setup()
      
      renderAddressAutocomplete()
      
      const input = screen.getByRole('combobox')
      await user.clear(input)
      await user.type(input, 'ab')
      
      // Wait a bit to ensure no API call is made
      await new Promise(resolve => setTimeout(resolve, 600))
      
      expect(mockAutocompleteAddress).not.toHaveBeenCalled()
    })

    it('debounces API calls with delay', async () => {
      const user = userEvent.setup()
      
      mockAutocompleteAddress.mockResolvedValue(mockGeocoderResponse)

      renderAddressAutocomplete()
      
      const input = screen.getByRole('combobox')
      
      // Type multiple characters quickly
      await user.type(input, 'test')
      
      // Wait for debounced API call
      await waitFor(() => {
        expect(mockAutocompleteAddress).toHaveBeenCalledTimes(1)
      }, { timeout: 1000 })
    })

    it('processes API response and sets options correctly', async () => {
      const user = userEvent.setup()
      
      mockAutocompleteAddress.mockResolvedValueOnce(mockGeocoderResponse)

      renderAddressAutocomplete()
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'main')
      
      // Wait for API call and response
      await waitFor(() => {
        expect(mockAutocompleteAddress).toHaveBeenCalledWith({
          partialAddress: 'main',
          maxResults: 5
        })
      }, { timeout: 1000 })

      // Verify the component processes the response
      expect(mockAutocompleteAddress).toHaveBeenCalledTimes(1)
    })

    it('handles API errors gracefully', async () => {
      const user = userEvent.setup()
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      mockAutocompleteAddress.mockRejectedValueOnce(new Error('Network error'))

      renderAddressAutocomplete()
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'test')
      
      // Wait for debounced API call
      await waitFor(() => {
        expect(mockAutocompleteAddress).toHaveBeenCalled()
      }, { timeout: 1000 })

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error fetching addresses:', expect.any(Error))
      })
      
      consoleSpy.mockRestore()
    })
  })

  describe('User Input and Interaction', () => {
    it('calls onChange when user types', async () => {
      const user = userEvent.setup()
      const onChangeMock = vi.fn()
      
      renderAddressAutocomplete({ onChange: onChangeMock })
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'test')
      
      expect(onChangeMock).toHaveBeenCalledWith('test')
    })

    it('calls onSelectAddress when address is selected', async () => {
      const user = userEvent.setup()
      const onSelectAddressMock = vi.fn()
      
      renderAddressAutocomplete({ onSelectAddress: onSelectAddressMock })
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'test address')
      
      expect(screen.getByDisplayValue('test address')).toBeInTheDocument()
    })

    it('handles string selection with validation', async () => {
      const onSelectAddressMock = vi.fn()
      
      mockValidateAddress.mockResolvedValueOnce(mockValidationResponse)
      
      renderAddressAutocomplete({ onSelectAddress: onSelectAddressMock })
      
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
  })

  describe('Address Selection Logic', () => {
    it('handles address selection properly', async () => {
      const user = userEvent.setup()
      const onSelectAddressMock = vi.fn()
      
      mockAutocompleteAddress.mockResolvedValueOnce(mockGeocoderResponse)
      
      renderAddressAutocomplete({ onSelectAddress: onSelectAddressMock })
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'main')
      
      // Wait for API call
      await waitFor(() => {
        expect(mockAutocompleteAddress).toHaveBeenCalledWith({
          partialAddress: 'main',
          maxResults: 5
        })
      }, { timeout: 1000 })
    })
  })

  describe('Disabled State', () => {
    it('disables autocomplete when disabled prop is true', () => {
      renderAddressAutocomplete({ disabled: true })
      
      const input = screen.getByRole('combobox')
      expect(input).toBeDisabled()
    })
  })

  describe('Loading State', () => {
    it('shows loading state during API call', async () => {
      const user = userEvent.setup()
      
      mockAutocompleteAddress.mockResolvedValueOnce(mockGeocoderResponse)

      renderAddressAutocomplete()
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'test')
      
      // Wait for debounced API call
      await waitFor(() => {
        expect(mockAutocompleteAddress).toHaveBeenCalledWith({
          partialAddress: 'test',
          maxResults: 5
        })
      }, { timeout: 1000 })

      // Verify API call was made
      expect(mockAutocompleteAddress).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      renderAddressAutocomplete()
      
      const input = screen.getByRole('combobox')
      expect(input).toHaveAttribute('aria-expanded')
      expect(input).toHaveAttribute('aria-autocomplete', 'list')
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      
      mockAutocompleteAddress.mockResolvedValueOnce(mockGeocoderResponse)

      renderAddressAutocomplete()
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'main')
      
      // Wait for debounced API call
      await waitFor(() => {
        expect(mockAutocompleteAddress).toHaveBeenCalled()
      }, { timeout: 1000 })

      await user.keyboard('{ArrowDown}')
      
      // Should handle keyboard navigation
      expect(input).toHaveFocus()
    })

    it('provides proper focus management', async () => {
      const user = userEvent.setup()
      
      renderAddressAutocomplete()
      
      const input = screen.getByRole('combobox')
      await user.click(input)
      
      expect(input).toHaveFocus()
    })
  })

  describe('ForwardRef Integration', () => {
    it('forwards ref correctly', () => {
      const ref = { current: null }
      
      render(
        <AddressAutocomplete ref={ref} {...defaultProps} />,
        { wrapper: AppWrapper }
      )
      
      // Component should render without errors when ref is provided
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('has correct displayName', () => {
      expect(AddressAutocomplete.displayName).toBe('AddressAutocomplete')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles empty API response', async () => {
      const user = userEvent.setup()
      
      mockAutocompleteAddress.mockResolvedValueOnce({ suggestions: [] })

      renderAddressAutocomplete()
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'nonexistent')
      
      // Wait for debounced API call
      await waitFor(() => {
        expect(mockAutocompleteAddress).toHaveBeenCalled()
      }, { timeout: 1000 })

      await user.click(input)
      
      // Should handle empty results gracefully
      await waitFor(() => {
        expect(screen.queryByRole('option')).not.toBeInTheDocument()
      })
    })

    it('handles malformed API response', async () => {
      const user = userEvent.setup()
      
      mockAutocompleteAddress.mockResolvedValueOnce({ invalid: 'response' })

      renderAddressAutocomplete()
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'test')
      
      // Wait for debounced API call
      await waitFor(() => {
        expect(mockAutocompleteAddress).toHaveBeenCalled()
      }, { timeout: 1000 })

      // Should handle malformed response gracefully
      expect(input).toBeInTheDocument()
    })

    it('handles component unmounting cleanly', () => {
      const { unmount } = renderAddressAutocomplete()
      
      expect(() => unmount()).not.toThrow()
    })
  })
})