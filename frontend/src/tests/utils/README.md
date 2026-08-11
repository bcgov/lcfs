# Shared Test Utilities

The frontend test fixtures provide lazy, explicit test capabilities. Import
`test` from `@/tests/utils/fixtures` and request only the providers a test uses.

```jsx
import { screen } from '@testing-library/react'
import { test } from '@/tests/utils/fixtures'

test('renders a routed component', ({ render, router, theme }) => {
  render(<Component />, [router, theme])

  expect(screen.getByRole('heading')).toBeInTheDocument()
})
```

Available fixtures include `render`, `renderHook`, `query`, `router`, `theme`,
`localization`, `i18n`, and `server`. Fixtures are initialized lazily: a
provider is not loaded unless the test callback requests it. The `app` fixture
loads the complete provider set and should be reserved for tests that genuinely
need all application providers.

## Cold-Start Performance Baseline

The following results are the durable local baseline captured on August 10,
2026 after the native fixture migration. Use them for comparisons only when the
suite, dependencies, hardware, and benchmark protocol remain materially
equivalent.

### Environment

- macOS host with 10 logical CPUs
- Vitest 4.1.8 using the `threads` pool
- Default per-file isolation enabled
- 362 test files
- 5,905 tests: 5,887 passed, 11 skipped, 7 todo
- Coverage disabled for timing
- No concurrent test processes

### Protocol

Before every run, wait for host load to settle and clear only Vitest's optimized
dependency cache:

```sh
setopt null_glob
for deps in node_modules/.vite/vitest/*/deps; do
  test -d "$deps" && rm -rf "$deps"
done
```

Run the complete suite from `frontend`:

```sh
/usr/bin/time -p npm run test:run -- --coverage.enabled=false --reporter=dot
```

Do not run multiple Vitest commands concurrently. Record the pre-run load,
Vitest duration, `real`/`user`/`sys` values, file count, and test count. Use the
median of three cold runs rather than a single result.

### Six Workers

Configuration:

```ts
pool: 'threads'
minWorkers: 6
maxWorkers: 6
```

| Run |  Vitest |    Real |     User |     Sys |
| --- | ------: | ------: | -------: | ------: |
| 1   | 456.07s | 456.60s | 2617.19s | 183.61s |
| 2   | 476.73s | 477.37s | 2726.26s | 183.69s |
| 3   | 428.87s | 429.32s | 2471.78s | 173.83s |

- Median real time: 456.60s
- Mean real time: 454.43s
- Range: 48.05s
- Population standard deviation: approximately 19.68s

### Eight Workers

Configuration:

```ts
pool: 'threads'
minWorkers: 8
maxWorkers: 8
```

| Run |  Vitest |    Real |     User |     Sys |
| --- | ------: | ------: | -------: | ------: |
| 1   | 441.14s | 441.76s | 3231.72s | 210.44s |
| 2   | 428.88s | 429.33s | 3191.63s | 196.15s |
| 3   | 436.98s | 437.44s | 3256.15s | 192.17s |

- Median real time: 437.44s
- Mean real time: 436.18s
- Range: 12.43s
- Population standard deviation: approximately 5.15s

Eight workers were approximately 4.2% faster by median and substantially more
stable than six workers. The current reproducible baseline should therefore use
eight fixed workers. A reasonable next optimization target is a cold median at
or below 400 seconds with no confirmation run above 420 seconds.

These measurements came from a dirty development worktree containing the
fixture migration. They are performance references, not evidence for a clean
historical Git baseline. Re-run the protocol after material suite, dependency,
Vitest, Node, or hardware changes.
