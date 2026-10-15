import Edit from '@mui/icons-material/Edit'
import BCButton from '@/components/BCButton'
import type { ComponentProps, ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material/styles'

// Header edit button shared by BCWidgetCard and cards that own their edit flow.
export const widgetEditButtonSx: SxProps<Theme> = {
  borderColor: 'rgba(255, 255, 255 , 1)',
  color: 'rgba(255, 255, 255 , 1)',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    color: 'rgba(0, 0, 0, 0.9)',
    borderColor: 'rgba(0, 0, 0, 0.8)'
  }
}

type WidgetEditButtonProps = Omit<
  ComponentProps<typeof BCButton>,
  'children' | 'variant' | 'size' | 'color' | 'startIcon'
> & {
  children: ReactNode
}

export const WidgetEditButton = ({
  children,
  sx,
  style,
  ...props
}: WidgetEditButtonProps) => (
  <BCButton
    variant="outlined"
    size="small"
    color="light"
    startIcon={<Edit sx={{ width: '16px', height: '16px' }} />}
    style={{ maxHeight: '25px', minHeight: '25px', ...style }}
    sx={{ ...widgetEditButtonSx, ...(sx as object) }}
    {...props}
  >
    {children}
  </BCButton>
)

export default WidgetEditButton
