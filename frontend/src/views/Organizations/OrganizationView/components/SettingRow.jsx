import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { ROW_LABEL_WIDTH } from './fieldLayout'

/**
 * One setting on the Organization details card: a bold label in a fixed-width
 * column with its control or value beside it. On narrow screens the label
 * stacks above the control.
 */
export const SettingRow = ({
  label,
  labelId,
  children,
  controlHeight,
  ...rest
}) => (
  <BCBox
    display="grid"
    gridTemplateColumns={{ xs: '1fr', md: `${ROW_LABEL_WIDTH}px 1fr` }}
    columnGap={1}
    rowGap={0.5}
    alignItems="center"
    {...rest}
  >
    <BCTypography
      variant="body4"
      id={labelId}
      sx={{ whiteSpace: { md: 'nowrap' } }}
    >
      <strong>{label}:</strong>
    </BCTypography>
    <BCBox display="flex" alignItems="center" minHeight={controlHeight}>
      {children}
    </BCBox>
  </BCBox>
)
