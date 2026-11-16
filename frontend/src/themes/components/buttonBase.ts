import type { Components, Theme } from '@mui/material/styles'
const buttonBase: NonNullable<Components<Theme>['MuiButtonBase']> = {
  defaultProps: {
    disableRipple: false
  }
}

export default buttonBase
