/**
 * The mock-up underlines links. The portal's global `a:link, a:visited`
 * rule removes underlines with !important, so the underline has to match
 * those states with a more specific selector.
 */
export const underlinedLink = {
  color: 'link.main',
  '&:link, &:visited': { textDecoration: 'underline !important' }
}
