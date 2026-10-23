import '@mui/material/Typography'

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    body4: true
    label: true
  }
}
