import breakpoints from '../base/breakpoints'
import { pxToRem } from '../utils'

const {
  values: { sm, md, lg, xl, xxl }
} = breakpoints

const SM = `@media (min-width: ${sm}px)`
const MD = `@media (min-width: ${md}px)`
const LG = `@media (min-width: ${lg}px)`
const XL = `@media (min-width: ${xl}px)`
const XXL = `@media (min-width: ${xxl}px)`

const sharedClasses = {
  marginLeft: 'auto !important',
  marginRight: 'auto !important',
  marginTop: '2rem',
  width: '100% !important',
  position: 'relative'
}

const container = {
  [SM]: {
    '.MuiContainer-root': {
      ...sharedClasses,
      maxWidth: '720px !important'
    }
  },
  [MD]: {
    '.MuiContainer-root': {
      ...sharedClasses,
      maxWidth: '940px !important'
    }
  },
  [LG]: {
    '.MuiContainer-root': {
      ...sharedClasses,
      maxWidth: '1640px !important'
    }
  },
  [XL]: {
    '.MuiContainer-root': {
      ...sharedClasses,
      maxWidth: '1340px !important'
    }
  },
  [XXL]: {
    '.MuiContainer-root': {
      ...sharedClasses,
      maxWidth: 'none !important'
    }
  }
}

export default container
