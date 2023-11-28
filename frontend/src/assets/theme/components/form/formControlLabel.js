import colors from 'assets/theme/base/colors';
import typography from 'assets/theme/base/typography';
import { pxToRem } from 'assets/theme/utils';

const { dark } = colors;
const { size, fontWeightBold } = typography;

const formControlLabel = {
  styleOverrides: {
    root: {
      display: 'flex',
      alignItems: 'start',
      gap: 8,
      minHeight: pxToRem(24),
      marginBottom: pxToRem(2),
      marginLeft: 0,
      marginRight: 0,
    },

    label: {
      display: 'inline-block',
      fontSize: size.md,
      fontWeight: fontWeightBold,
      color: dark.main,
      lineHeight: '20px',
      transform: `translateY(${pxToRem(1)})`,
      marginLeft: pxToRem(4),

      '&.Mui-disabled': {
        color: dark.main,
      },
    },
  },
};

export default formControlLabel;
