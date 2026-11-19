import type { Components, Theme } from '@mui/material/styles'
const appBar: NonNullable<Components<Theme>['MuiAppBar']> = {
  defaultProps: {
    color: 'transparent'
  },

  styleOverrides: {
    root: {
      // add default styling for appBar component
    }
  }
}

export default appBar
