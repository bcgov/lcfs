import colors from 'assets/theme/base/colors';
import borders from 'assets/theme/base/borders';
import typography from 'assets/theme/base/typography';

import { pxToRem } from 'assets/theme/utils';

const { inputBorderColor, info, grey, transparent, background } = colors;
const { borderRadius } = borders;
const { size } = typography;

const inputOutlined = {
  styleOverrides: {
    root: {
      backgroundColor: transparent.main,
      fontSize: size.sm,
      borderRadius: borderRadius.md,
      overflow: 'hidden',

      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: inputBorderColor,
      },

      '&.Mui-focused': {
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: info.main,
        },
      },
    },

    notchedOutline: {
      borderColor: inputBorderColor,
    },

    input: {
      color: grey[700],
      padding: pxToRem(12),
      backgroundColor: background.default,
    },

    inputSizeSmall: {
      fontSize: size.xs,
      padding: pxToRem(10),
    },

    multiline: {
      color: grey[700],
      padding: 0,
    },
  },
};

export default inputOutlined;
