import '@mui/material/Typography'

import type { default as borders } from '../themes/base/borders'
import type { default as boxShadows } from '../themes/base/boxShadows'
import type { default as colors } from '../themes/base/colors'
import type { default as typography } from '../themes/base/typography'
import type {
  boxShadow,
  hexToRgb,
  linearGradient,
  pxToRem,
  rgba
} from '../themes/utils'

type CustomPalette = Pick<
  typeof colors,
  | 'pending'
  | 'transparent'
  | 'white'
  | 'black'
  | 'glacier'
  | 'link'
  | 'nav'
  | 'input'
  | 'smoky'
  | 'light'
  | 'dark'
  | 'badgeColors'
  | 'coloredShadows'
  | 'inputBorderColor'
  | 'borderDivider'
  | 'tabs'
  | 'alerts'
  | 'gradients'
>

type CustomTypography = Pick<
  typeof typography,
  | 'fontSizeXXS'
  | 'fontSizeXS'
  | 'fontSizeSM'
  | 'fontSizeMD'
  | 'fontSizeLG'
  | 'fontSizeXL'
  | 'fontSize2XL'
  | 'fontSize3XL'
  | 'headerSizeH1'
  | 'headerSizeH2'
  | 'headerSizeH3'
  | 'headerSizeH4'
  | 'headerSizeH5'
  | 'headerSizeH6'
  | 'body3'
  | 'body4'
  | 'body5'
  | 'label'
  | 'caption1'
  | 'd1'
  | 'd2'
  | 'd3'
  | 'd4'
  | 'd5'
  | 'd6'
  | 'size'
  | 'lineHeight'
>

interface ThemeFunctions {
  boxShadow: typeof boxShadow
  hexToRgb: typeof hexToRgb
  linearGradient: typeof linearGradient
  pxToRem: typeof pxToRem
  rgba: typeof rgba
}

declare module '@mui/material/styles' {
  interface BreakpointOverrides {
    xxl: true
    hd: true
    u4k: true
  }

  interface Palette extends CustomPalette {}

  interface PaletteOptions extends Partial<CustomPalette> {}

  interface Theme {
    borders: typeof borders
    boxShadows: typeof boxShadows
    functions: ThemeFunctions
  }

  interface ThemeOptions {
    borders?: typeof borders
    boxShadows?: typeof boxShadows
    functions?: ThemeFunctions
  }

  interface TypographyVariants extends CustomTypography {}

  interface TypographyVariantsOptions extends Partial<CustomTypography> {}
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    body3: true
    body4: true
    body5: true
    label: true
    caption1: true
    d1: true
    d2: true
    d3: true
    d4: true
    d5: true
    d6: true
  }
}
