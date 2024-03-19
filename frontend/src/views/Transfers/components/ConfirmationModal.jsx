import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import colors from '@/themes/base/colors'
import { Box, Modal } from '@mui/material'
import { useTranslation } from 'react-i18next'

export const ConfirmationModal = ({ data, onClose }) => {
  const { t } = useTranslation(['common'])
  if (!data) return null
  return (
    <Modal
      open={data}
      onClose={onClose}
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <Box p={2}>
        <Box
          bgcolor={colors.background.default}
          minWidth={'75vw'}
          borderRadius={2}
          overflow={'hidden'}
        >
          <Box bgcolor={colors.primary.main} p={2}>
            <BCTypography color={'light'}>{t('common:confirmation')}</BCTypography>
          </Box>
          <Box p={2}>
            <BCTypography>{data.text}</BCTypography>
          </Box>
          <hr />
          <Box p={2} display={'flex'} justifyContent={'flex-end'} gap={2}>
            <BCButton variant="outlined" color="error" onClick={onClose}>
              {t('common:cancelBtn')}
            </BCButton>
            <BCButton
              variant="contained"
              color="primary"
              onClick={data.onConfirm}
            >
              {data.buttonText}
            </BCButton>
          </Box>
        </Box>
      </Box>
    </Modal>
  )
}
