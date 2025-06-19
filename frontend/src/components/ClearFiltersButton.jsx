import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import BCButton from '@/components/BCButton'
import { faFilterCircleXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export const ClearFiltersButton = forwardRef(({
  onClick,
  size = 'small',
  color = 'primary',
  sx = {},
  ...otherProps
}, ref) => {
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
      {...otherProps}
    >
      {t('common:ClearFilters')}
    </BCButton>
  )
})