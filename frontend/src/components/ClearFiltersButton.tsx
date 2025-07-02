import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import BCButton from '@/components/BCButton'
import { faFilterCircleXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { RefObject } from 'react'

interface ClearFiltersButtonProps {
  onClick: () => void
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
  
  return (
    <BCButton
      ref={ref}
      variant="outlined"
      size={size}
      color={color}
      onClick={onClick}
      startIcon={<FontAwesomeIcon icon={faFilterCircleXmark} className="small-icon" />}
      sx={{...sx}}
      {...props}
    >
      {t('common:ClearFilters')}
    </BCButton>
  )
})