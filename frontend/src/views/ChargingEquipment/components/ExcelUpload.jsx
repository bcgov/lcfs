import React, { useState } from 'react'
import { Box, Alert } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faUpload } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import BCButton from '@/components/BCButton'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes'
import ImportDialog from '@/components/ImportDialog'
import {
  useImportChargingEquipment,
  useChargingEquipmentImportJobStatus
} from '@/hooks/useChargingEquipment'

export const ExcelUpload = ({ organizationId, onImportComplete }) => {
  const { t } = useTranslation(['chargingEquipment', 'common'])
  const apiService = useApiService()
  const [downloadError, setDownloadError] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)

  const downloadTemplate = async () => {
    if (!organizationId) {
      setDownloadError(t('chargingEquipment:templateMissingOrg'))
      return
    }

    try {
      setDownloadError('')
      setIsDownloading(true)
      await apiService.download({
        url: apiRoutes.chargingEquipment.template.replace(
          ':organizationId',
          organizationId
        )
      })
    } catch (error) {
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        t('chargingEquipment:templateDownloadError')
      setDownloadError(detail)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <>
      <Box display="flex" gap={2} alignItems="center" mb={2} flexWrap="wrap">
        <BCButton
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<FontAwesomeIcon icon={faDownload} />}
          onClick={downloadTemplate}
          disabled={isDownloading || !organizationId}
        >
          {t('common:importExport.export.btn')}
        </BCButton>

        <BCButton
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<FontAwesomeIcon icon={faUpload} />}
          onClick={() => setIsImportDialogOpen(true)}
          disabled={!organizationId}
        >
          {t('chargingEquipment:importBtn')}
        </BCButton>
      </Box>

      {downloadError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {downloadError}
        </Alert>
      )}

      {organizationId && (
        <ImportDialog
          open={isImportDialogOpen}
          close={() => setIsImportDialogOpen(false)}
          complianceReportId={organizationId}
          isOverwrite={false}
          importHook={useImportChargingEquipment}
          getJobStatusHook={useChargingEquipmentImportJobStatus}
          onComplete={(summary) => {
            onImportComplete?.(summary)
            setIsImportDialogOpen(false)
          }}
        />
      )}
    </>
  )
}
