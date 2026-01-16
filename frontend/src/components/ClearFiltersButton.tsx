import { forwardRef, type KeyboardEvent, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import BCButton from '@/components/BCButton'
import { faFilterCircleXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

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
      startIcon={<FontAwesomeIcon icon={faFilterCircleXmark} className="small-icon" />}
      sx={{ ...sx }}
      {...props}
    >
      {t('common:ClearFilters')}
    </BCButton>
  )
})