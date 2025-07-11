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
import { StyledChip } from '@/components/StyledChip'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getQuarterDateRange } from '@/utils/dateQuarterUtils'
import { dateToLongString } from '@/utils/formatters'

export const ActivityLinksList = ({
  currentStatus,
  isQuarterlyReport,
  reportQuarter
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const apiService = useApiService()
  const { compliancePeriod, complianceReportId } = useParams()
  const { data: currentUser } = useCurrentUser()

  const [isOpen, setIsOpen] = useState(false)

  const createActivity = (nameKey, labelKey, route, enableForQuarterly) => ({
    name: t(nameKey),
    label: t(labelKey),
    enableForQuarterly,
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
      const endpoint = apiRoutes.exportComplianceReport.replace(
        ':reportID',
        complianceReportId
      )
      await apiService.download({ url: endpoint })
    } finally {
      setIsDownloading(false)
    }
  }

  const primaryList = useMemo(
    () => [
      createActivity(
        'report:activityLists.supplyOfFuel',
        'report:activityLabels.supplyOfFuel',
        ROUTES.REPORTS.ADD.SUPPLY_OF_FUEL,
        true
      ),
      createActivity(
        'report:activityLists.notionalTransfers',
        'report:activityLabels.notionalTransfers',
        ROUTES.REPORTS.ADD.NOTIONAL_TRANSFERS,
        true
      ),
      createActivity(
        'report:activityLists.fuelsOtherUse',
        'report:activityLabels.fuelsOtherUse',
        ROUTES.REPORTS.ADD.OTHER_USE_FUELS,
        false
      ),
      createActivity(
        'report:activityLists.exportFuels',
        'report:activityLabels.exportFuels',
        ROUTES.REPORTS.ADD.FUEL_EXPORTS,
        false
      )
    ],
    [t, navigate, compliancePeriod, complianceReportId]
  )

  const secondaryList = useMemo(
    () => [
      createActivity(
        'report:activityLists.finalSupplyEquipment',
        'report:activityLabels.finalSupplyEquipment',
        ROUTES.REPORTS.ADD.FINAL_SUPPLY_EQUIPMENTS,
        true
      ),
      createActivity(
        'report:activityLists.allocationAgreements',
        'report:activityLabels.allocationAgreements',
        ROUTES.REPORTS.ADD.ALLOCATION_AGREEMENTS,
        true
      ),
      {
        name: t('report:activityLists.uploadDocuments'),
        label: t('report:activityLabels.uploadDocuments'),
        action: () => {
          setIsOpen(true)
        },
        enableForQuarterly: true
      }
    ],
    [t, navigate, compliancePeriod, complianceReportId]
  )

  const quarterAsStr = `Q${reportQuarter}`
  const dateRange = getQuarterDateRange(quarterAsStr, compliancePeriod)

  return (
    <>
      {isQuarterlyReport && (
        <BCTypography variant="body4" color="text" component="p" sx={{ mb: 2 }}>
          Did{' '}
          <span style={{ fontWeight: 'bold' }}>
            {currentUser?.organization?.name}
          </span>{' '}
          engage in any of the following activities between{' '}
          {dateToLongString(dateRange.from)} and{' '}
          {dateToLongString(dateRange.to)}?
        </BCTypography>
      )}
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
        {primaryList
          .filter((activity) => {
            if (!isQuarterlyReport) return true

            // For Q1-Q3: only show activities with enableForQuarterly=true
            if (reportQuarter && [1, 2, 3].includes(reportQuarter)) {
              return activity.enableForQuarterly
            }

            // For Q4: show all activities (same as annual)
            return true
          })
          .map((activity) => (
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
        {secondaryList
          .filter((activity) => {
            if (!isQuarterlyReport) return true

            // For Q1-Q3: only show activities with enableForQuarterly=true
            if (reportQuarter && [1, 2, 3].includes(reportQuarter)) {
              return activity.enableForQuarterly
            }

            // For Q4: show all activities (same as annual)
            return true
          })
          .map((activity) => (
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
                cursor: 'pointer',
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
        onUploadSuccess={() => {
          // any action on successful upload
        }}
      />
    </>
  )
}
