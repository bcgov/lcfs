import { afterAll, afterEach, beforeAll } from 'vitest'
import { http } from 'msw'
import { setupServer } from 'msw/node'
import { handlers } from './handlers.jsx'

const api = 'http://localhost:8000/api'
const unhandledRejectionGuard = Symbol.for('lcfs.test.unhandledRejectionGuard')

export const testServer = setupServer(...handlers)

export const httpOverwrite = (method, endpoint, cb, once) => {
  return testServer.use(http[method](api + endpoint, cb, { once }))
}

const installUnhandledRejectionGuard = () => {
  if (process[unhandledRejectionGuard]) return

  const originalUnhandledRejection = process.listeners('unhandledRejection')
  process.removeAllListeners('unhandledRejection')
  process.on('unhandledRejection', (reason) => {
    if (
      reason?.message?.includes('Expected signal') &&
      reason?.message?.includes('AbortSignal')
    ) return
    originalUnhandledRejection.forEach((listener) => listener(reason))
  })
  process[unhandledRejectionGuard] = true
}

export const setupMsw = () => {
  beforeAll(() => {
    installUnhandledRejectionGuard()
    testServer.listen({ onUnhandledRequest: 'bypass' })
  })

  afterEach(() => testServer.resetHandlers())
  afterAll(() => testServer.close())
}
