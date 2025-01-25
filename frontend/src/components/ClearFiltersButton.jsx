import { useTranslation } from 'react-i18next'
import BCButton from '@/components/BCButton'
import { faFilterCircleXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export const ClearFiltersButton = ({
  onClick,
  size = 'small',
  color = 'primary',
  sx = {},
  buttonRef = null
}) => {
  const { t } = useTranslation(['common'])
  
  return (
    <BCButton
      ref={buttonRef}
      variant="outlined"
      size={size}
      color={color}
      onClick={onClick}
      startIcon={<FontAwesomeIcon icon={faFilterCircleXmark} className="small-icon" />}
      sx={{...sx}}
    >
      {t('common:ClearFilters')}
    </BCButton>
  )
}