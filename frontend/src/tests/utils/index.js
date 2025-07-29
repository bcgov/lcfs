/**
 * Central exports for all shared test utilities
 * 
 * This file provides easy access to all testing utilities from a single import.
 * 
 * Usage:
 * import { AppWrapper, getByDataTest, mockMaterialUi } from '@/tests/utils'
 */

// Test helpers (only the ones actually used)
export { getByDataTest } from './testHelpers.js'

// Existing wrapper and MSW handlers  
export { wrapper as AppWrapper, testQueryClient } from './wrapper.jsx'
export { handlers, httpOverwrite } from './handlers.jsx'

// Mock utilities (only Material UI mocks that are used)
export { mockMaterialUi } from './mocks/materialUi.jsx'