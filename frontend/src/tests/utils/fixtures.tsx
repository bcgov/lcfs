/// <reference types="vite/client" />

import {
  cleanup,
  render as rtlRender,
  renderHook as rtlRenderHook
} from '@testing-library/react'
import { test as baseTest } from 'vitest'
import type {
  RenderHookOptions,
  RenderHookResult,
  RenderOptions,
  RenderResult
} from '@testing-library/react'
import type { QueryClient, QueryClientConfig } from '@tanstack/react-query'
import type { i18n as I18nInstance } from 'i18next'
import type { RequestHandler } from 'msw'
import type { ReactElement, ReactNode } from 'react'

export type ProviderKind =
  | 'query'
  | 'theme'
  | 'localization'
  | 'router'
  | 'i18n'
  | 'custom'

export interface ProviderValue {
  readonly kind: ProviderKind
  readonly wrap: (children: ReactNode) => ReactElement
}

export interface QueryProviderValue extends ProviderValue {
  readonly kind: 'query'
  readonly client: QueryClient
  readonly with: (config?: QueryClientConfig) => QueryProviderValue
}

export interface RouterProviderValue extends ProviderValue {
  readonly kind: 'router'
  readonly with: (options?: RouterOptions) => RouterProviderValue
}

export interface RouterOptions {
  readonly initialEntries?: readonly string[]
}

export interface I18nProviderValue extends ProviderValue {
  readonly kind: 'i18n'
  readonly instance: I18nInstance
}

export interface TestServer {
  readonly use: (...handlers: unknown[]) => unknown
  readonly resetHandlers: () => void
  readonly close: () => void
  readonly httpOverwrite: (
    method: string,
    endpoint: string,
    callback: unknown,
    once?: boolean
  ) => unknown
}

export type TestRender = (
  ui: ReactNode,
  providers?: readonly ProviderValue[],
  options?: Omit<RenderOptions, 'wrapper'>
) => RenderResult

export type TestRenderHook = <Result, Props = undefined>(
  callback: (initialProps: Props) => Result,
  providers?: readonly ProviderValue[],
  options?: Omit<RenderHookOptions<Props>, 'wrapper'>
) => RenderHookResult<Result, Props>

export interface TestFixtures {
  readonly server: TestServer
  readonly query: QueryProviderValue
  readonly router: RouterProviderValue
  readonly theme: ProviderValue & { readonly kind: 'theme' }
  readonly localization: ProviderValue & { readonly kind: 'localization' }
  readonly i18n: I18nProviderValue
  readonly app: readonly ProviderValue[]
  readonly render: TestRender
  readonly renderHook: TestRenderHook
}

const providerOrder: Record<ProviderKind, number> = {
  query: 0,
  theme: 1,
  localization: 2,
  router: 3,
  i18n: 4,
  custom: 5
}

const canonicalizeProviders = (providers: readonly ProviderValue[]) => {
  const kinds = new Set<ProviderKind>()

  for (const provider of providers) {
    if (kinds.has(provider.kind)) {
      throw new Error(`Duplicate test provider: ${provider.kind}`)
    }
    kinds.add(provider.kind)
  }

  return [...providers].sort(
    (left, right) => providerOrder[left.kind] - providerOrder[right.kind]
  )
}

const providerWrapper = (providers: readonly ProviderValue[]) => {
  const canonicalProviders = canonicalizeProviders(providers)

  return ({ children }: { children: ReactNode }) =>
    canonicalProviders.reduceRight(
      (child, provider) => provider.wrap(child),
      children as ReactElement
    )
}

const makeProvider = <Kind extends ProviderKind>(
  kind: Kind,
  wrap: (children: ReactNode) => ReactElement
): ProviderValue & { readonly kind: Kind } => ({ kind, wrap })

const defaultQueryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: { staleTime: 0, retry: false },
    mutations: { retry: false }
  }
}

const mergeQueryClientConfig = (
  base: QueryClientConfig,
  next: QueryClientConfig
): QueryClientConfig => ({
  ...base,
  ...next,
  defaultOptions: {
    ...base.defaultOptions,
    ...next.defaultOptions,
    queries: {
      ...base.defaultOptions?.queries,
      ...next.defaultOptions?.queries
    },
    mutations: {
      ...base.defaultOptions?.mutations,
      ...next.defaultOptions?.mutations
    }
  }
})

const makeQueryProvider = (
  QueryClient: typeof import('@tanstack/react-query').QueryClient,
  QueryClientProvider: typeof import('@tanstack/react-query').QueryClientProvider,
  config: QueryClientConfig = {}
): QueryProviderValue => {
  const resolvedConfig = mergeQueryClientConfig(
    defaultQueryClientConfig,
    config
  )
  const client = new QueryClient(resolvedConfig)

  return {
    kind: 'query',
    client,
    with: (nextConfig = {}) =>
      makeQueryProvider(
        QueryClient,
        QueryClientProvider,
        mergeQueryClientConfig(resolvedConfig, nextConfig)
      ),
    wrap: (children) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  }
}

const makeRouterProvider = (
  MemoryRouter: typeof import('react-router').MemoryRouter,
  options: RouterOptions = {}
): RouterProviderValue => {
  const initialEntries = options.initialEntries ?? ['/']
  const value: RouterProviderValue = {
    kind: 'router',
    with: (nextOptions = {}) =>
      makeRouterProvider(MemoryRouter, { ...options, ...nextOptions }),
    wrap: (children) => (
      <MemoryRouter initialEntries={[...initialEntries]}>
        {children}
      </MemoryRouter>
    )
  }

  return value
}

const readModuleExport = <Value,>(module: object, name: string) => {
  try {
    return (module as Record<string, unknown>)[name] as Value
  } catch {
    return undefined
  }
}

let unhandledRejectionGuardInstalled = false

const installUnhandledRejectionGuard = () => {
  if (unhandledRejectionGuardInstalled) {
    return
  }

  const originalUnhandledRejection = process.listeners(
    'unhandledRejection'
  ) as Array<(reason: unknown) => void>
  process.removeAllListeners('unhandledRejection')
  process.on('unhandledRejection', (reason) => {
    if (
      reason instanceof Error &&
      reason.message.includes('Expected signal') &&
      reason.message.includes('AbortSignal')
    ) {
      return
    }
    originalUnhandledRejection.forEach((listener) => {
      listener(reason)
    })
  })
  unhandledRejectionGuardInstalled = true
}

const buildI18nProvider = async (): Promise<I18nProviderValue> => {
  const [
    { default: i18next },
    { I18nextProvider, initReactI18next },
    { loadI18nResources }
  ] = await Promise.all([
    import('i18next'),
    import('react-i18next'),
    import('./capabilities/resources')
  ])
  const instance = i18next.createInstance()
  if (initReactI18next) {
    instance.use(initReactI18next)
  }
  await instance.init({
    resources: await loadI18nResources(),
    defaultNS: 'common',
    lng: 'en',
    interpolation: { escapeValue: false }
  })

  return {
    kind: 'i18n',
    instance,
    wrap: (children) =>
      I18nextProvider ? (
        <I18nextProvider i18n={instance}>{children}</I18nextProvider>
      ) : (
        (children as ReactElement)
      )
  }
}

export const test = baseTest
  .extend('server', async ({ task }, { onCleanup }): Promise<TestServer> => {
    void task
    const [{ setupServer }, { http }, { handlers }] = await Promise.all([
      import('msw/node'),
      import('msw'),
      import('./handlers.jsx')
    ])
    const api = 'http://localhost:8000/api'
    const requestHandlers = handlers as RequestHandler[]
    const server = setupServer(...requestHandlers)

    installUnhandledRejectionGuard()
    server.listen({ onUnhandledRequest: 'bypass' })
    onCleanup(() => {
      server.resetHandlers()
      server.close()
    })

    return {
      use: (...requestHandlers) =>
        server.use(...(requestHandlers as RequestHandler[])),
      resetHandlers: () => server.resetHandlers(),
      close: () => server.close(),
      httpOverwrite: (method, endpoint, callback, once) =>
        server.use(
          (
            http as unknown as Record<
              string,
              (
                url: string,
                resolver: unknown,
                options?: unknown
              ) => RequestHandler
            >
          )[method](api + endpoint, callback, { once })
        )
    }
  })
  .extend(
    'query',
    async ({ task }, { onCleanup }): Promise<QueryProviderValue> => {
      void task
      const { QueryClient, QueryClientProvider } = await import(
        '@tanstack/react-query'
      )
      const value = makeQueryProvider(QueryClient, QueryClientProvider)
      onCleanup(() => value.client.clear())
      return value
    }
  )
  .extend('router', async (): Promise<RouterProviderValue> => {
    const routerDom = await import('react-router-dom')
    const routerDomMemoryRouter = readModuleExport<
      typeof import('react-router').MemoryRouter
    >(routerDom, 'MemoryRouter')
    if (routerDomMemoryRouter) {
      return makeRouterProvider(routerDomMemoryRouter)
    }
    const { MemoryRouter } = await import('react-router')
    return makeRouterProvider(MemoryRouter)
  })
  .extend('theme', async () => {
    const [{ CssBaseline, ThemeProvider }, { default: theme }] =
      await Promise.all([import('@mui/material'), import('@/themes')])
    return makeProvider('theme', (children) => (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    ))
  })
  .extend('localization', async () => {
    const [{ LocalizationProvider }, { AdapterDateFns }] = await Promise.all([
      import('@mui/x-date-pickers'),
      import('@mui/x-date-pickers/AdapterDateFnsV3')
    ])
    return makeProvider('localization', (children) => (
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        {children}
      </LocalizationProvider>
    ))
  })
  .extend('i18n', async ({ task }, { onCleanup }) => {
    void task
    const value = await buildI18nProvider()
    onCleanup(() => value.instance.off('*'))
    return value
  })
  .extend('app', async ({ query, theme, localization, router, i18n }) =>
    canonicalizeProviders([query, theme, localization, router, i18n])
  )
  .extend('render', async ({ task }, { onCleanup }): Promise<TestRender> => {
    void task
    onCleanup(cleanup)
    return (ui, providers = [], options = {}) => {
      if (providers.length === 0) {
        return rtlRender(ui, options)
      }
      return rtlRender(ui, {
        ...options,
        wrapper: providerWrapper(providers)
      })
    }
  })
  .extend(
    'renderHook',
    async ({ task }, { onCleanup }): Promise<TestRenderHook> => {
      void task
      onCleanup(cleanup)
      return (callback, providers = [], options = {}) => {
        if (providers.length === 0) {
          return rtlRenderHook(callback, options)
        }
        return rtlRenderHook(callback, {
          ...options,
          wrapper: providerWrapper(providers)
        })
      }
    }
  )

export { makeProvider, providerWrapper }
