/**
 * Queries an element in the document using a 'data-test' attribute.
 *
 * @param {string} testId The 'data-test' attribute value to match.
 * @returns {HTMLElement|null} The matched element or null if not found.
 *
 * Usage:
 * const element = getByDataTest('test-id');
 */
export const getByDataTest = (testId) => {
  return document.body.querySelector(`[data-test="${testId}"]`)
}
