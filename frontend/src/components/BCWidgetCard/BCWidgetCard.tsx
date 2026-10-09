import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import type { CardProps } from '@mui/material/Card'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { useNavigate } from 'react-router-dom'
import { WidgetEditButton } from './WidgetEditButton'
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
  headerAction?: ReactNode
  editButtonStyles?: Record<string, unknown>
  headerSx?: Record<string, unknown>
}

const BCWidgetCard = ({
  color = 'nav',
  title = 'Title',
  content,
  style,
  editButton = null,
  headerAction = null,
  editButtonStyles = {},
  headerSx = {},
  sx,
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

  const combinedCardSx: SxProps<Theme> = Array.isArray(sx)
    ? [cardStyles, ...sx]
    : sx
      ? [cardStyles, sx]
      : [cardStyles]

  return (
    <Card sx={combinedCardSx} {...cardProps}>
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
            <WidgetEditButton
              id={editButton.id}
              onClick={handleButtonClick}
              sx={editButtonStyles || {}}
            >
              {editButton.text}
            </WidgetEditButton>
          )}
          {headerAction}
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
