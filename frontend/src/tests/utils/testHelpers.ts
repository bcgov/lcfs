/**
 * Test helpers for LCFS application testing
 */

/**
 * Queries an element in the document using a 'data-test' attribute.
 */
export const getByDataTest = (testId: string) => {
  return document.body.querySelector(`[data-test="${testId}"]`)
}
