import BCModal from '@/components/BCModal'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { Box, CircularProgress } from '@mui/material'
import { useTranslation } from 'react-i18next'

export const BulkActionModals = ({
  showSubmitModal,
  showDecommissionModal,
  selectedCount,
  onSubmitConfirm,
  onDecommissionConfirm,
  onSubmitCancel,
  onDecommissionCancel,
  isSubmitting,
  isDecommissioning
}) => {
  const { t } = useTranslation(['chargingEquipment'])

  return (
    <>
      <BCModal
        open={showSubmitModal}
        onClose={onSubmitCancel}
        title={t('chargingEquipment:submitConfirmTitle')}
      >
        <Box p={3}>
          <BCTypography variant="body1" gutterBottom>
            {t('chargingEquipment:submitConfirmMessage', { count: selectedCount })}
          </BCTypography>
          <BCTypography variant="body2" color="text.secondary" paragraph>
            {t('chargingEquipment:submitConfirmWarning')}
          </BCTypography>
          
          <Box display="flex" justifyContent="flex-end" gap={2} mt={3}>
            <BCButton
              variant="outlined"
              onClick={onSubmitCancel}
              disabled={isSubmitting}
            >
              {t('common:cancel')}
            </BCButton>
            <BCButton
              variant="contained"
              color="primary"
              onClick={onSubmitConfirm}
              disabled={isSubmitting}
              startIcon={isSubmitting && <CircularProgress size={20} />}
            >
              {t('chargingEquipment:submitSelected')}
            </BCButton>
          </Box>
        </Box>
      </BCModal>

      <BCModal
        open={showDecommissionModal}
        onClose={onDecommissionCancel}
        title={t('chargingEquipment:decommissionConfirmTitle')}
      >
        <Box p={3}>
          <BCTypography variant="body1" gutterBottom>
            {t('chargingEquipment:decommissionConfirmMessage', { count: selectedCount })}
          </BCTypography>
          <BCTypography variant="body2" color="error" paragraph>
            {t('chargingEquipment:decommissionConfirmWarning')}
          </BCTypography>
          
          <Box display="flex" justifyContent="flex-end" gap={2} mt={3}>
            <BCButton
              variant="outlined"
              onClick={onDecommissionCancel}
              disabled={isDecommissioning}
            >
              {t('common:cancel')}
            </BCButton>
            <BCButton
              variant="contained"
              color="error"
              onClick={onDecommissionConfirm}
              disabled={isDecommissioning}
              startIcon={isDecommissioning && <CircularProgress size={20} />}
            >
              {t('chargingEquipment:setToDecommissioned')}
            </BCButton>
          </Box>
        </Box>
      </BCModal>
    </>
  )
}