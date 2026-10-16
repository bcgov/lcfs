// Every counter in a dashboard card is given the same width, wide enough for
// the card's longest number and never narrower than MIN_COUNT_DIGITS (#4911).
// Kept apart from CountDisplay so that file only exports components.
export const MIN_COUNT_DIGITS = 3

/** The digits a card's counter column needs: its longest count, at least
 * MIN_COUNT_DIGITS. Missing counts are ignored. */
export const countDigits = (...counts) =>
  Math.max(
    MIN_COUNT_DIGITS,
    ...counts
      .filter((count) => count != null)
      .map((count) => String(count).length)
  )
