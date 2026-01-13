import { forwardRef, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import BCButton from '@/components/BCButton'
import FilterListOffIcon from '@mui/icons-material/FilterListOff'
import { RefObject } from 'react'

interface ClearFiltersButtonProps {
  onClick?: () => void
  size?: 'small' | 'medium' | 'large'
  color?: 'primary' | 'secondary'
  sx?: Record<string, any>
  buttonRef?: RefObject<HTMLButtonElement> | null
  disabled?: boolean
  [key: string]: any // For spreading additional props
}

export const ClearFiltersButton = forwardRef<HTMLButtonElement, ClearFiltersButtonProps>(({
  onClick,
  size = 'small',
  color = 'primary',
  sx = {},
  ...props
}: ClearFiltersButtonProps, ref) => {
  const { t } = useTranslation(['common'])

  // Handle keyboard events for accessibility
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
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
      endIcon={<FilterListOffIcon className="small-icon" />}
      sx={{...sx}}
      {...props}
    >
      {t('common:ClearFilters')}
    </BCButton>
  )
})