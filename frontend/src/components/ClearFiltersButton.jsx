import { useTranslation } from 'react-i18next'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEraser } from '@fortawesome/free-solid-svg-icons';

export const ClearFiltersButton = ({ onClick }) => {
  const { t } = useTranslation(['common'])
  
  return (
    <BCButton
      onClick={onClick}
      variant="outlined"
      size="small"
      color="primary"
      sx={{
        whiteSpace: 'nowrap',
        height: '40px', // Match the height of other buttons
        padding: '0 16px', // Match horizontal padding
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px', // Space between icon and text
      }}
      data-test="clear-filters-button"
    > 
      <BCTypography variant="subtitle2">
        {t('common:ClearFilters')}
      </BCTypography>
    </BCButton>
  )
}