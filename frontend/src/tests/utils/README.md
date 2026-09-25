# Frontend test fixtures

Import the extended `test` and request only the setup a test uses:

```jsx
import { screen } from '@testing-library/react'
import { test } from '@/tests/utils/fixtures'

test('renders a routed component', ({ render, router, theme }) => {
  render(<Component />, [router, theme])
  expect(screen.getByRole('heading')).toBeInTheDocument()
})
```

Available fixtures are `render`, `renderHook`, `query`, `router`, `theme`,
`localization`, `i18n`, and `server`. They load lazily; `app` composes the full
provider set for integration tests.

The `query` fixture creates a fresh React Query client per test. The `server`
fixture starts MSW only for tests that request it and resets handlers on cleanup.
