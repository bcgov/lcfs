import { Typography } from '@mui/material'

export const Label = ({ children, ...rest }) => (
  <Typography fontSize={16} fontWeight={600} component={'label'} {...rest}>
    {children}
  </Typography>
)
