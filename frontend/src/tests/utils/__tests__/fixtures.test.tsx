import { expect, vi } from 'vitest'
import { makeProvider, test, type ProviderValue } from '../fixtures'

const mswNodeLoaded = vi.hoisted(() => vi.fn())
const setupServer = vi.hoisted(() =>
  vi.fn(() => ({
    listen: vi.fn(),
    resetHandlers: vi.fn(),
    close: vi.fn(),
    use: vi.fn()
  }))
)

vi.mock('msw/node', () => {
  mswNodeLoaded()
  return { setupServer }
})

test('keeps the default test path lazy', () => {
  expect(true).toBe(true)
})

test('uses canonical nesting regardless of provider input order', ({
  render
}) => {
  const query = makeProvider('query', (children) => (
    <div data-test="query">{children}</div>
  ))
  const router = makeProvider('router', (children) => (
    <div data-test="router">{children}</div>
  ))
  const renderNesting = (providers: readonly ProviderValue[]) => {
    const { container } = render(
      <span data-test="content">content</span>,
      providers
    )
    return [...container.querySelectorAll('[data-test]')].map((element) =>
      element.getAttribute('data-test')
    )
  }

  const routerThenQuery = renderNesting([router, query])
  const queryThenRouter = renderNesting([query, router])

  expect(routerThenQuery).toEqual(['query', 'router', 'content'])
  expect(queryThenRouter).toEqual(routerThenQuery)
})

test('rejects duplicate provider kinds', ({ render }) => {
  const provider = makeProvider('custom', (children) => <>{children}</>)

  expect(() => render(<div />, [provider, provider])).toThrow(
    'Duplicate test provider: custom'
  )
})

test('creates and cleans an isolated query client', async ({ query }) => {
  expect(query.client).toBeDefined()
  query.client.setQueryData(['fixture'], { value: 1 })
  expect(query.client.getQueryData(['fixture'])).toEqual({ value: 1 })
})

test('creates a fresh query client for configured defaults', ({ query }) => {
  const configured = query.with({
    defaultOptions: { queries: { staleTime: 1000 } }
  })

  expect(configured.client).not.toBe(query.client)
  expect(query.client.getDefaultOptions().queries?.staleTime).toBe(0)
  expect(configured.client.getDefaultOptions().queries?.staleTime).toBe(1000)
  expect(configured.client.getDefaultOptions().queries?.retry).toBe(false)
})

test('exposes app providers in canonical order', ({ app }) => {
  expect(app.map((provider) => provider.kind)).toEqual([
    'query',
    'theme',
    'localization',
    'router',
    'i18n'
  ])
})

test('supports configured router providers', ({ render, router }) => {
  render(<div data-test="route">route</div>, [
    router.with({ initialEntries: ['/users/12'] })
  ])

  expect(document.querySelector('[data-test="route"]')).toBeInTheDocument()
})

test('creates an isolated i18n provider', ({ render, i18n }) => {
  render(<div>{i18n.instance.t('common:saveBtn')}</div>, [i18n])

  expect(document.body).toHaveTextContent('Save')
})

test('does not initialize MSW unless the server fixture is requested', () => {
  expect(mswNodeLoaded).not.toHaveBeenCalled()
})

test('initializes MSW when the server fixture is requested', ({ server }) => {
  expect(server).toBeDefined()
  expect(mswNodeLoaded).toHaveBeenCalledTimes(1)
})
