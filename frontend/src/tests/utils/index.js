/**
 * Central exports for all shared test utilities
 *
 * This file provides easy access to all testing utilities from a single import.
 *
 * Usage:
 * import { test, getByDataTest, mockMaterialUi } from '@/tests/utils'
 */

// Test helpers (only the ones actually used)
export { getByDataTest } from './testHelpers.js'

// Lazy test fixtures
export { test } from './fixtures'

// Mock utilities (only Material UI mocks that are used)
export { mockMaterialUi } from './mocks/materialUi.jsx'
