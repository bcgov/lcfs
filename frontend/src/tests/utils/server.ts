import { afterAll, afterEach, beforeAll } from 'vite-plus/test'
import { http } from 'msw'
import { setupServer } from 'msw/node'
import { handlers } from './handlers'
import type { HttpResponseResolver } from 'msw'

const api = 'http://localhost:8000/api'
const unhandledRejectionGuard = Symbol.for('lcfs.test.unhandledRejectionGuard')

export const testServer = setupServer(...handlers)

export type HttpMethod = keyof typeof http
export type RequestResolver = HttpResponseResolver

export const httpOverwrite = (
  method: HttpMethod,
  endpoint: string,
  cb: RequestResolver,
  once = false
) => {
  const url = api + endpoint
  const options = { once }

  return testServer.use(http[method](url, cb, options))
}

const installUnhandledRejectionGuard = () => {
  if (Reflect.get(process, unhandledRejectionGuard)) return

  const originalUnhandledRejection = process.listeners('unhandledRejection')
  process.removeAllListeners('unhandledRejection')
  process.on('unhandledRejection', (reason, promise) => {
    if (
      reason instanceof Error &&
      reason.message.includes('Expected signal') &&
      reason.message.includes('AbortSignal')
    )
      return
    originalUnhandledRejection.forEach((listener) => listener(reason, promise))
  })
  Reflect.set(process, unhandledRejectionGuard, true)
}

export const setupMsw = () => {
  beforeAll(() => {
    installUnhandledRejectionGuard()
    testServer.listen({ onUnhandledRequest: 'bypass' })
  })

  afterEach(() => testServer.resetHandlers())
  afterAll(() => testServer.close())
}
