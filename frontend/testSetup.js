import { handlers } from '@/tests/utils/handlers'
import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { afterEach, vi } from 'vitest'
import { config } from './public/config/config'
import '@/i18n'
import { testQueryClient } from '@/tests/utils/wrapper'

configure({ testIdAttribute: 'data-test' })

export const testServer = setupServer(...handlers)

beforeAll(async () => {
  vi.stubGlobal('lcfs_config', config)
  testServer.listen({ onUnhandledRequest: 'error' })
  vi.mock('react-snowfall')
})

afterEach(() => {
  cleanup()
  testQueryClient.clear()
  testServer.resetHandlers()
})

afterAll(() => {
  testServer.close()
})
