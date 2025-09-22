import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import { Box } from '@mui/material'
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

  const submitModalData = {
    title: t('chargingEquipment:submitConfirmTitle'),
    content: (
      <Box p={3}>
        <BCTypography variant="body1" gutterBottom>
          {t('chargingEquipment:submitConfirmMessage', {
            count: selectedCount
          })}
        </BCTypography>
        <BCTypography variant="body2" color="text.secondary" paragraph>
          {t('chargingEquipment:submitConfirmWarning')}
        </BCTypography>
      </Box>
    ),
    primaryButtonText: t('chargingEquipment:submitSelected'),
    primaryButtonAction: onSubmitConfirm,
    primaryButtonDisabled: isSubmitting,
    secondaryButtonText: t('common:cancel'),
    secondaryButtonAction: onSubmitCancel
  }

  const decommissionModalData = {
    title: t('chargingEquipment:decommissionConfirmTitle'),
    content: (
      <Box p={3}>
        <BCTypography variant="body1" gutterBottom>
          {t('chargingEquipment:decommissionConfirmMessage', {
            count: selectedCount
          })}
        </BCTypography>
        <BCTypography variant="body2" color="error" paragraph>
          {t('chargingEquipment:decommissionConfirmWarning')}
        </BCTypography>
      </Box>
    ),
    primaryButtonText: t('chargingEquipment:setToDecommissioned'),
    primaryButtonAction: onDecommissionConfirm,
    primaryButtonColor: 'error',
    primaryButtonDisabled: isDecommissioning,
    secondaryButtonText: t('common:cancel'),
    secondaryButtonAction: onDecommissionCancel
  }

  return (
    <>
      <BCModal
        open={showSubmitModal}
        onClose={onSubmitCancel}
        title={submitModalData.title}
        children={
          <>
            {submitModalData.content}
            <Box p={3} display="flex" gap={2}>
              <button disabled={isSubmitting} onClick={onSubmitCancel}>
                {t('common:cancel')}
              </button>
              <button disabled={isSubmitting} onClick={onSubmitConfirm}>
                {t('chargingEquipment:submitSelected')}
              </button>
            </Box>
          </>
        }
        data={submitModalData}
      />
      <BCModal
        open={showDecommissionModal}
        onClose={onDecommissionCancel}
        title={decommissionModalData.title}
        children={
          <>
            {decommissionModalData.content}
            <Box p={3} display="flex" gap={2}>
              <button
                disabled={isDecommissioning}
                onClick={onDecommissionCancel}
              >
                {t('common:cancel')}
              </button>
              <button
                disabled={isDecommissioning}
                onClick={onDecommissionConfirm}
              >
                {t('chargingEquipment:setToDecommissioned')}
              </button>
            </Box>
          </>
        }
        data={decommissionModalData}
      />
    </>
  )
}
