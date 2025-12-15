import React, { useState } from 'react'
import { Box, Alert } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faUpload } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import BCButton from '@/components/BCButton'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes'
import ImportDialog from '@/components/ImportDialog'
import {
  useImportChargingEquipment,
  useChargingEquipmentImportJobStatus
} from '@/hooks/useChargingEquipment'

export const ExcelUpload = ({
  onDataParsed,
  chargingSites = [],
  levels = [],
  endUseTypes = [],
  endUserTypes = [],
  organizationId,
  onImportComplete
}) => {
  const { t } = useTranslation(['chargingEquipment', 'common'])
  const apiService = useApiService()
  const [uploadError, setUploadError] = useState('')
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

  const parseNumber = (value) => {
    if (value === undefined || value === null || value === '') return ''
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : ''
  }

  const parseTemplateFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result)
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet)

          const normalizeValue = (value, { upper = false } = {}) => {
            if (value === undefined || value === null) return ''
            const text =
              typeof value === 'string' ? value.trim() : String(value).trim()
            return upper ? text.toUpperCase() : text
          }

          const transformedData = jsonData.map((row, index) => {
            const siteValue =
              row['Charging Site'] ||
              row['Charging site'] ||
              row['Site name'] ||
              row['Site Name'] ||
              ''
            const normalizedSiteName = normalizeValue(siteValue)
            const latitudeCell = row['Latitude']
            const longitudeCell = row['Longitude']

            const chargingSite = chargingSites.find((site) => {
              const displayName = normalizeValue(
                site.siteName || site.site_name || ''
              )
              const siteCode = normalizeValue(
                site.siteCode || site.site_code || '',
                { upper: true }
              )

              if (!normalizedSiteName) return false

              return (
                (displayName &&
                  normalizedSiteName.toLowerCase() ===
                    displayName.toLowerCase()) ||
                (siteCode && normalizedSiteName.toUpperCase() === siteCode)
              )
            })

            const intendedUseIds = []
            if (row['Intended Uses']) {
              const useNames = row['Intended Uses']
                .split(',')
                .map((s) => s.trim())
              useNames.forEach((useName) => {
                const useType = endUseTypes.find((type) => {
                  const label = type.type || type.type_name || ''
                  return (
                    label &&
                    useName &&
                    label.trim().toLowerCase() === useName.trim().toLowerCase()
                  )
                })
                const useId =
                  useType?.end_use_type_id ?? useType?.endUseTypeId ?? null
                if (useId) {
                  intendedUseIds.push(useId)
                }
              })
            }

            const intendedUserIds = []
            if (row['Intended Users']) {
              const userNames = row['Intended Users']
                .split(',')
                .map((s) => s.trim())
              userNames.forEach((userName) => {
                const userType = endUserTypes.find((type) => {
                  const label = type.type_name || type.typeName || ''
                  return (
                    label &&
                    userName &&
                    label.trim().toLowerCase() === userName.trim().toLowerCase()
                  )
                })
                const userId =
                  userType?.end_user_type_id ?? userType?.endUserTypeId ?? null
                if (userId) {
                  intendedUserIds.push(userId)
                }
              })
            }

            const level = levels.find((l) => {
              const levelName = l.name || l.level_name
              const target =
                row['Level of Equipment'] || row['Level Of Equipment']
              return (
                levelName &&
                target &&
                levelName.trim().toLowerCase() === target.trim().toLowerCase()
              )
            })

            const chargingSiteId =
              chargingSite?.charging_site_id ??
              chargingSite?.chargingSiteId ??
              ''
            const levelId =
              level?.level_of_equipment_id ?? level?.levelOfEquipmentId ?? ''

            const defaultLatitude =
              chargingSite?.latitude ?? chargingSite?.lat ?? ''
            const defaultLongitude =
              chargingSite?.longitude ?? chargingSite?.lng ?? ''
            const latitudeOverride = parseNumber(latitudeCell)
            const longitudeOverride = parseNumber(longitudeCell)
            const latitude =
              latitudeOverride !== '' ? latitudeOverride : defaultLatitude
            const longitude =
              longitudeOverride !== '' ? longitudeOverride : defaultLongitude

            const serialNumber = row['Serial Number'] || ''
            const manufacturer = row['Manufacturer'] || ''
            const model = row['Model'] || ''
            const notes = row['Notes'] || ''

            const rowErrors = {
              charging_site_id: !chargingSite
                ? 'Charging site not found'
                : '',
              level_of_equipment_id: !level
                ? 'Level of equipment not found'
                : '',
              serial_number: !row['Serial Number']
                ? 'Serial number is required'
                : '',
              manufacturer: !row['Manufacturer']
                ? 'Manufacturer is required'
                : '',
              intended_use_ids:
                intendedUseIds.length === 0
                  ? 'At least one intended use is required'
                  : '',
              intended_user_ids:
                intendedUserIds.length === 0
                  ? 'At least one intended user is required'
                  : ''
            }
            const hasErrors = Object.values(rowErrors).some(Boolean)
            const importStatus = hasErrors
              ? t('chargingEquipment:importFailed')
              : t('chargingEquipment:importPending')

            return {
              id: Date.now() + index,
              charging_site_id: chargingSiteId,
              chargingSiteId,
              allocating_organization_name: '',
              serial_number: serialNumber,
              serialNumber,
              manufacturer,
              model,
              level_of_equipment_id: levelId,
              levelOfEquipmentId: levelId,
              ports: row['Ports'] || 'Single port',
              intended_use_ids: intendedUseIds,
              intendedUseIds,
              intended_user_ids: intendedUserIds,
              intendedUserIds,
              notes,
              latitude,
              longitude,
              excelRowNumber: index + 2,
              validationStatus: hasErrors ? 'error' : 'success',
              importStatus,
              isImportPending: !hasErrors,
              _errors: rowErrors
            }
          })

          resolve(transformedData)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })

  const handleFileSelectedForImport = async (file) => {
    try {
      setUploadError('')
      const data = await parseTemplateFile(file)
      onDataParsed(data)
    } catch (error) {
      console.error('Excel parsing error:', error)
      const message =
        error?.message ||
        'Error parsing Excel file. Please check the format and try again.'
      setUploadError(message)
      throw new Error(message)
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

      {uploadError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {uploadError}
        </Alert>
      )}

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
          onFileSelected={handleFileSelectedForImport}
        />
      )}
    </>
  )
}
