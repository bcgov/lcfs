import BCTypography from '@/components/BCTypography'
import { MIN_COUNT_DIGITS } from './countDigits'

// The number beside a dashboard link (#4911). Every counter in a card is
// given the same width, wide enough for the card's longest number and never
// narrower than MIN_COUNT_DIGITS, and the number sits at its right edge.
// Extra digits therefore grow to the left and the links stay in one column:
// 1, 10, 99, 100 and 999 all leave a card's links where they are.

// When `hidden`, the counter keeps its width and height but shows and
// announces nothing, so a link without a number lines up with the counted
// links above it.
export const CountDisplay = ({
  count,
  digits = MIN_COUNT_DIGITS,
  hidden = false
}) => (
  <BCTypography
    component="span"
    variant="h3"
    aria-hidden={hidden || undefined}
    sx={{
      color: 'success.main',
      display: 'inline-block',
      flexShrink: 0,
      // ch is the width of a digit in this font, and tabular figures keep
      // every digit that wide.
      minWidth: `${digits}ch`,
      fontVariantNumeric: 'tabular-nums',
      textAlign: 'right',
      whiteSpace: 'nowrap',
      marginRight: 3,
      ...(hidden && { visibility: 'hidden' })
    }}
  >
    {hidden ? ' ' : count}
  </BCTypography>
)

export default CountDisplay
