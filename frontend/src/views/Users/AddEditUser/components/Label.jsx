import { Typography, InputLabel } from '@mui/material'

export const Label = ({ children, ...rest }) => (
  <InputLabel {...rest}>
    <Typography fontSize={16} fontWeight={600} component={'label'} {...rest}>
      {children}
    </Typography>
  </InputLabel>
)
