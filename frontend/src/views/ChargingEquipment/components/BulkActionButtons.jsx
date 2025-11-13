import BCButton from '@/components/BCButton'
import {
  faCheck,
  faBan,
  faSquareCheck
} from '@fortawesome/free-solid-svg-icons'
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

  const draftUpdatedCount = selectedRows.filter(
    (r) => r.status === 'Draft' || r.status === 'Updated'
  ).length
  const validatedCount = selectedRows.filter(
    (r) => r.status === 'Validated'
  ).length

  // Render nothing if no actions are available
  if (!canSubmit && !canDecommission) {
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
          disabled={draftUpdatedCount === 0}
        >
          {`${t('chargingEquipment:submitSelected')} (${draftUpdatedCount})`}
        </BCButton>
      )}

      {canDecommission && (
        <BCButton
          variant="outlined"
          color="primary"
          size="medium"
          startIcon={<FontAwesomeIcon icon={faBan} />}
          onClick={onDecommissionClick}
          disabled={validatedCount === 0}
        >
          {`${t('chargingEquipment:setToDecommissioned')} (${validatedCount})`}
        </BCButton>
      )}
    </Box>
  )
}
