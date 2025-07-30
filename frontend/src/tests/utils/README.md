# Shared Test Utilities

Essential test utilities for the LCFS frontend application.

## Directory Structure

```
/src/tests/utils/
├── mocks/              # Material-UI mocks for BC Form components
├── testHelpers.js      # Basic test helper functions
├── wrapper.jsx         # App-level test wrapper
├── handlers.jsx        # MSW API handlers
└── index.js           # Central exports
```

## Usage

```javascript
import { AppWrapper, getByDataTest, mockMaterialUi } from '@/tests/utils'

describe('MyComponent', () => {
  beforeEach(() => {
    mockMaterialUi()
  })

  it('should render correctly', () => {
    render(<MyComponent />, { wrapper: AppWrapper })
    expect(getByDataTest('my-element')).toBeInTheDocument()
  })
})
```

## Available Utilities

- **`AppWrapper`** - Test wrapper with providers and context
- **`testQueryClient`** - Pre-configured React Query client for tests
- **`handlers`** - MSW request handlers for API mocking
- **`httpOverwrite`** - Override specific API endpoints in tests
- **`getByDataTest(testId)`** - Query elements by data-test attribute
- **`mockMaterialUi()`** - Mock Material-UI components for BC Form testing

## Migration from Complex Utilities

If migrating from the previous complex utility structure:

```javascript
// Before (complex)
import { renderWithForm, mockReactHookForm, createMockFormData } from '@/tests/utils'

// After (simplified)
import { AppWrapper, getByDataTest } from '@/tests/utils'
render(<Component />, { wrapper: AppWrapper })
```