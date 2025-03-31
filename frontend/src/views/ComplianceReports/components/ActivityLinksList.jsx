import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Box, List } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { apiRoutes } from '@/constants/routes'
import { ROUTES } from '@/routes/routes'
import Chip from '@mui/material/Chip'
import { styled } from '@mui/material/styles'
import colors from '@/themes/base/colors.js'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog.jsx'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import BCButton from '@/components/BCButton/index.jsx'
import { useApiService } from '@/services/useApiService.js'
import { FileDownload } from '@mui/icons-material'

export const StyledChip = styled(Chip)({
  fontWeight: 'bold',
  height: '26px',
  margin: '6px 8px 6px 4px',
  fontSize: '16px',
  borderRadius: '8px',
  backgroundColor: colors.nav.main
})

export const ActivityLinksList = ({ currentStatus }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const apiService = useApiService()
  const { compliancePeriod, complianceReportId } = useParams()

  const [isOpen, setIsOpen] = useState(false)

  const createActivity = (nameKey, labelKey, route) => ({
    name: t(nameKey),
    label: t(labelKey),
    action: () => {
      navigate(
        route
          .replace(':compliancePeriod', compliancePeriod)
          .replace(':complianceReportId', complianceReportId)
      )
    }
  })

  const [isDownloading, setIsDownloading] = useState(false)
  const onDownloadReport = async () => {
    setIsDownloading(true)
    try {
      await apiService.download(
        apiRoutes.exportComplianceReport.replace(
          ':reportID',
          complianceReportId
        )
      )
    } finally {
      setIsDownloading(false)
    }
  }

  const primaryList = useMemo(
    () => [
      createActivity(
        'report:activityLists.supplyOfFuel',
        'report:activityLabels.supplyOfFuel',
        ROUTES.REPORTS.ADD.SUPPLY_OF_FUEL
      ),
      createActivity(
        'report:activityLists.notionalTransfers',
        'report:activityLabels.notionalTransfers',
        ROUTES.REPORTS.ADD.NOTIONAL_TRANSFERS
      ),
      createActivity(
        'report:activityLists.fuelsOtherUse',
        'report:activityLabels.fuelsOtherUse',
        ROUTES.REPORTS.ADD.OTHER_USE_FUELS
      ),
      createActivity(
        'report:activityLists.exportFuels',
        'report:activityLabels.exportFuels',
        ROUTES.REPORTS.ADD.FUEL_EXPORTS
      )
    ],
    [t, navigate, compliancePeriod, complianceReportId, createActivity]
  )

  const secondaryList = useMemo(
    () => [
      createActivity(
        'report:activityLists.finalSupplyEquipment',
        'report:activityLabels.finalSupplyEquipment',
        ROUTES.REPORTS.ADD.FINAL_SUPPLY_EQUIPMENTS
      ),
      createActivity(
        'report:activityLists.allocationAgreements',
        'report:activityLabels.allocationAgreements',
        ROUTES.REPORTS.ADD.ALLOCATION_AGREEMENTS
      ),
      {
        name: t('report:activityLists.uploadDocuments'),
        label: t('report:activityLabels.uploadDocuments'),
        action: () => {
          setIsOpen(true)
        }
      }
    ],
    [t, navigate, compliancePeriod, complianceReportId, createActivity]
  )

  return (
    <>
      <BCTypography
        variant="body4"
        color="text"
        component="div"
        fontWeight="bold"
      >
        {t('report:activityLinksList')}:
      </BCTypography>
      <List
        data-test="schedule-list"
        component="div"
        sx={{ maxWidth: '100%', listStyleType: 'disc' }}
      >
        {primaryList.map((activity) => (
          <Box
            sx={{ cursor: 'pointer' }}
            component="a"
            key={activity.name}
            alignItems="flex-start"
            onClick={activity.action}
            data-test={activity.label}
          >
            <BCTypography
              variant="subtitle2"
              color="link"
              sx={{
                textDecoration: 'underline',
                '&:hover': { color: 'info.main' }
              }}
            >
              <StyledChip color="primary" label={activity.label} />
              {activity.name}
            </BCTypography>
          </Box>
        ))}
      </List>
      <BCTypography
        variant="body4"
        fontWeight="bold"
        color="text"
        component="div"
      >
        {t('report:activitySecondList')}:
      </BCTypography>
      <List
        data-test="schedule-list"
        component="div"
        sx={{ maxWidth: '100%', listStyleType: 'disc' }}
      >
        {secondaryList.map((activity) => (
          <Box
            sx={{ cursor: 'pointer' }}
            component="a"
            key={activity.name}
            alignItems="flex-start"
            onClick={activity.action}
            data-test={activity.label}
          >
            <BCTypography
              variant="subtitle2"
              color="link"
              sx={{
                textDecoration: 'underline',
                '&:hover': { color: 'info.main' }
              }}
            >
              <StyledChip color="primary" label={activity.label} />
              {activity.name}
            </BCTypography>
          </Box>
        ))}
      </List>
      {currentStatus === COMPLIANCE_REPORT_STATUSES.DRAFT && (
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
          <BCButton
            data-test="download-report"
            size="small"
            className="svg-icon-button"
            variant="outlined"
            color="primary"
            onClick={onDownloadReport}
            startIcon={<FileDownload />}
            sx={{ mr: 2 }}
            isLoading={isDownloading}
            disabled={isDownloading}
          >
            {t('report:downloadExcel')}
          </BCButton>
          {!isDownloading && (
            <BCTypography
              variant="subtitle2"
              disabled={isDownloading}
              color="link"
              onClick={onDownloadReport}
              sx={{
                textDecoration: 'underline',
                '&:hover': { color: 'info.main' }
              }}
            >
              {t('report:activityLists.downloadExcel')}
            </BCTypography>
          )}
        </Box>
      )}
      <DocumentUploadDialog
        parentID={complianceReportId}
        parentType="compliance_report"
        open={isOpen}
        close={() => {
          setIsOpen(false)
        }}
      />
    </>
  )
}
