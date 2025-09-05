import BCButton from '@/components/BCButton'
import { faCheck, faBan } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Box } from '@mui/material'
import { useTranslation } from 'react-i18next'

export const BulkActionButtons = ({
  selectedRows,
  canSubmit,
  canDecommission,
  onSubmitClick,
  onDecommissionClick
}) => {
  const { t } = useTranslation(['chargingEquipment'])

  if (selectedRows.length === 0) {
    return null
  }

  return (
    <Box display="flex" gap={2}>
      {canSubmit && (
        <BCButton
          variant="contained"
          color="primary"
          size="medium"
          startIcon={<FontAwesomeIcon icon={faCheck} />}
          onClick={onSubmitClick}
        >
          {t('chargingEquipment:submitSelected')} ({selectedRows.filter(r => 
            r.status === 'Draft' || r.status === 'Updated'
          ).length})
        </BCButton>
      )}
      
      {canDecommission && (
        <BCButton
          variant="outlined"
          color="error"
          size="medium"
          startIcon={<FontAwesomeIcon icon={faBan} />}
          onClick={onDecommissionClick}
        >
          {t('chargingEquipment:setToDecommissioned')} ({selectedRows.filter(r => 
            r.status === 'Validated'
          ).length})
        </BCButton>
      )}
    </Box>
  )
}