import colors from './colors'
import { pxToRem } from '../utils'

const { text } = colors
// https://developer.gov.bc.ca/Design-System/Typography
const baseProperties = {
  fontFamily: "'BCSans', 'Noto Sans', 'Verdana', 'Arial', 'sans-serif'",
  fontWeightLighter: 100,
  fontWeightLight: 300,
  fontWeightRegular: 400,
  fontWeightMedium: 600,
  fontWeightBold: 700,
  fontSizeXXS: pxToRem(10.4),
  fontSizeXS: pxToRem(12),
  fontSizeSM: pxToRem(14),
  fontSizeMD: pxToRem(16),
  fontSizeLG: pxToRem(18),
  fontSizeXL: pxToRem(20),
  fontSize2XL: pxToRem(24),
  fontSize3XL: pxToRem(30),
  headerSizeH1: '2.986rem',
  headerSizeH2: '2.488rem',
  headerSizeH3: '2.074rem',
  headerSizeH4: '1.728rem',
  headerSizeH5: '1.44rem',
  headerSizeH6: '1.2rem'
}

const baseHeadingProperties = {
  fontFamily: baseProperties.fontFamily,
  color: text.main,
  fontWeight: baseProperties.fontWeightRegular
}

const baseDisplayProperties = {
  fontFamily: baseProperties.fontFamily,
  color: text.main,
  fontWeight: baseProperties.fontWeightLight,
  lineHeight: 1.2
}

const typography = {
  fontFamily: baseProperties.fontFamily,
  fontWeightLighter: baseProperties.fontWeightLighter,
  fontWeightLight: baseProperties.fontWeightLight,
  fontWeightRegular: baseProperties.fontWeightRegular,
  fontWeightMedium: baseProperties.fontWeightMedium,
  fontWeightBold: baseProperties.fontWeightBold,

  h1: {
    fontSize: baseProperties.headerSizeH1,
    lineHeight: 1.25,
    ...baseHeadingProperties
  },

  h2: {
    fontSize: baseProperties.headerSizeH2,
    lineHeight: 1.3,
    ...baseHeadingProperties
  },

  h3: {
    fontSize: baseProperties.headerSizeH3,
    lineHeight: 1.375,
    ...baseHeadingProperties
  },

  h4: {
    fontSize: baseProperties.headerSizeH4,
    lineHeight: 1.375,
    ...baseHeadingProperties
  },

  h5: {
    fontSize: baseProperties.headerSizeH5,
    lineHeight: 1.375,
    fontWeight: baseProperties.fontWeightMedium,
    fontFamily: baseProperties.fontFamily,
    color: text.main
  },

  h6: {
    fontSize: baseProperties.headerSizeH6,
    lineHeight: 1.375,
    fontWeight: baseProperties.fontWeightMedium,
    fontFamily: baseProperties.fontFamily,
    color: text.main
  },

  subtitle1: {
    fontFamily: baseProperties.fontFamily,
    fontSize: baseProperties.fontSizeLG,
    fontWeight: baseProperties.fontWeightLight,
    lineHeight: 1.625
  },

  subtitle2: {
    fontFamily: baseProperties.fontFamily,
    fontSize: baseProperties.fontSizeMD,
    fontWeight: baseProperties.fontWeightLight,
    lineHeight: 1.6
  },

  body1: {
    fontFamily: baseProperties.fontFamily,
    fontSize: baseProperties.fontSizeXL,
    fontWeight: baseProperties.fontWeightRegular,
    lineHeight: 1.625
  },
  // default paragraph font size is 16px(1em) with a line height of 1.6
  body2: {
    fontFamily: baseProperties.fontFamily,
    fontSize: baseProperties.fontSizeMD,
    fontWeight: baseProperties.fontWeightLight,
    lineHeight: 1.6
  },

  body3: {
    fontFamily: baseProperties.fontFamily,
    fontSize: baseProperties.fontSizeSM,
    fontWeight: baseProperties.fontWeightLight,
    lineHeight: 1.6
  },
  body4: {
    fontFamily: baseProperties.fontFamily,
    fontSize: baseProperties.fontSizeMD,
    fontWeight: baseProperties.fontWeightRegular,
    lineHeight: 1.625
  },

  button: {
    fontFamily: baseProperties.fontFamily,
    fontSize: baseProperties.fontSizeMD,
    fontWeight: baseProperties.fontWeightLight,
    lineHeight: 1.625,
    textTransform: 'none'
  },

  caption: {
    fontFamily: baseProperties.fontFamily,
    fontSize: baseProperties.fontSizeXS,
    fontWeight: baseProperties.fontWeightLight,
    lineHeight: 1.25
  },

  caption1: {
    fontFamily: baseProperties.fontFamily,
    fontSize: baseProperties.fontSizeSM,
    fontWeight: baseProperties.fontWeightLight,
    lineHeight: 1.25
  },

  overline: {
    fontFamily: baseProperties.fontFamily
  },

  d1: {
    fontSize: pxToRem(80),
    ...baseDisplayProperties
  },

  d2: {
    fontSize: pxToRem(72),
    ...baseDisplayProperties
  },

  d3: {
    fontSize: pxToRem(64),
    ...baseDisplayProperties
  },

  d4: {
    fontSize: pxToRem(56),
    ...baseDisplayProperties
  },

  d5: {
    fontSize: pxToRem(48),
    ...baseDisplayProperties
  },

  d6: {
    fontSize: pxToRem(40),
    ...baseDisplayProperties
  },

  size: {
    xxs: baseProperties.fontSizeXXS,
    xs: baseProperties.fontSizeXS,
    sm: baseProperties.fontSizeSM,
    md: baseProperties.fontSizeMD,
    lg: baseProperties.fontSizeLG,
    xl: baseProperties.fontSizeXL,
    '2xl': baseProperties.fontSize2XL,
    '3xl': baseProperties.fontSize3XL
  },

  lineHeight: {
    sm: 1.25,
    md: 1.5,
    lg: 2
  }
}

export default typography
