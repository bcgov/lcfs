import { forwardRef, type KeyboardEvent, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { ButtonProps } from '@mui/material/Button'
import type { SxProps, Theme } from '@mui/material/styles'
import BCButton from '@/components/BCButton'
import FilterListOffIcon from '@mui/icons-material/FilterListOff'

interface ClearFiltersButtonProps
  extends Omit<ButtonProps, 'size' | 'color' | 'sx' | 'onClick'> {
  onClick?: () => void
  size?: 'small' | 'medium' | 'large'
  color?: 'primary' | 'secondary'
  sx?: SxProps<Theme>
  buttonRef?: RefObject<HTMLButtonElement> | null
  disabled?: boolean
}

export const ClearFiltersButton = forwardRef<HTMLButtonElement, ClearFiltersButtonProps>(({
  onClick,
  size = 'small',
  color = 'primary',
  sx = {},
  ...props
}: ClearFiltersButtonProps, ref) => {
  const { t } = useTranslation(['common'])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' && !event.repeat) {
      event.preventDefault()
      event.currentTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    }
  }

  const handleKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      onClick?.()
    }
  }

  return (
    <BCButton
      ref={ref}
      variant="outlined"
      size={size}
      color={color}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      endIcon={<FilterListOffIcon className="small-icon" />}
      sx={{...sx}}
      {...props}
    >
      {t('common:ClearFilters')}
    </BCButton>
  )
})

ClearFiltersButton.displayName = 'ClearFiltersButton'
