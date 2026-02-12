import { Card, CardContent, Divider, type CardProps } from '@mui/material'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { useNavigate } from 'react-router-dom'
import { Edit } from '@mui/icons-material'
import BCButton from '@/components/BCButton'
import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material/styles'

type WidgetColor =
  | 'primary'
  | 'secondary'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'light'
  | 'nav'
  | 'dark'

type EditButtonConfig = {
  id?: string
  text: ReactNode
  route?: string
  onClick?: () => void
}

export interface BCWidgetCardProps
  extends Omit<CardProps, 'title' | 'content'> {
  color?: WidgetColor
  title?: ReactNode
  content: ReactNode
  editButton?: EditButtonConfig | null
  editButtonStyles?: Record<string, unknown>
  headerSx?: Record<string, unknown>
}

const BCWidgetCard = ({
  color = 'nav',
  title = 'Title',
  content,
  style,
  editButton = null,
  editButtonStyles = {},
  headerSx = {},
  ...cardProps
}: BCWidgetCardProps) => {
  const navigate = useNavigate()

  const handleButtonClick = () => {
    if (editButton?.route) {
      navigate(editButton.route)
    }
    if (editButton?.onClick) {
      editButton.onClick()
    }
  }

  const cardStyles: SxProps<Theme> = {
    border: '1px solid #8c8c8c',
    mb: 5,
    ...(style || {})
  }

  const defaultButtonStyles: SxProps<Theme> = {
    borderColor: 'rgba(255, 255, 255 , 1)',
    color: 'rgba(255, 255, 255 , 1)',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      color: 'rgba(0, 0, 0, 0.9)',
      borderColor: 'rgba(0, 0, 0, 0.8)'
    }
  }

  const buttonSx: SxProps<Theme> = {
    ...defaultButtonStyles,
    ...(editButtonStyles || {})
  }

  return (
    <Card sx={cardStyles} {...cardProps}>
      <BCBox display="flex" justifyContent="center" pt={1} py={1.5}>
        <BCBox
          variant="contained"
          bgColor={color}
          color={color === 'light' ? 'dark' : 'white'}
          coloredShadow={color}
          borderRadius="md"
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          px={2}
          py={1}
          width="100%"
          mx={2}
          mt={-3}
          sx={headerSx}
        >
          <BCTypography
            variant="subtitle2"
            fontWeight="light"
            color="inherit"
            component="h2"
          >
            {title}
          </BCTypography>
          {editButton && (
            <BCButton
              id={editButton.id}
              variant="outlined"
              size="small"
              style={{ maxHeight: '25px', minHeight: '25px' }}
              color="light"
              onClick={handleButtonClick}
              startIcon={<Edit sx={{ width: '16px', height: '16px' }} />}
              sx={buttonSx}
            >
              {editButton.text}
            </BCButton>
          )}
        </BCBox>
      </BCBox>
      <Divider
        aria-hidden="true"
        light={false}
        sx={{ borderBottom: '1px solid #c0c0c0' }}
      />
      <CardContent>{content}</CardContent>
    </Card>
  )
}

export default BCWidgetCard
