import BCTypography from '@/components/BCTypography'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Chip,
  CircularProgress,
  IconButton,
  Link
} from '@mui/material'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import BCAlert from '@/components/BCAlert'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'
import { Role } from '@/components/Role'
import { TogglePanel } from '@/components/TogglePanel.jsx'
import { REPORT_SCHEDULES } from '@/constants/common.js'
import { roles } from '@/constants/roles'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { useGetAllAllocationAgreements } from '@/hooks/useAllocationAgreement'
import {
  useComplianceReportDocuments,
  useGetComplianceReport
} from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useGetFinalSupplyEquipments } from '@/hooks/useFinalSupplyEquipment'
import { useGetFuelExports } from '@/hooks/useFuelExport'
import { useGetFuelSupplies } from '@/hooks/useFuelSupply'
import { useGetAllNotionalTransfers } from '@/hooks/useNotionalTransfer'
import { useGetAllOtherUses } from '@/hooks/useOtherUses'
import { ROUTES, buildPath } from '@/routes/routes'
import colors from '@/themes/base/colors'
import { isArrayEmpty } from '@/utils/array.js'
import { AllocationAgreementChangelog } from '@/views/AllocationAgreements/AllocationAgreementChangelog.jsx'
import { AllocationAgreementSummary } from '@/views/AllocationAgreements/AllocationAgreementSummary'
import { FinalSupplyEquipmentSummary } from '@/views/FinalSupplyEquipments/FinalSupplyEquipmentSummary'
import { FuelExportChangelog } from '@/views/FuelExports/FuelExportChangelog.jsx'
import { FuelExportSummary } from '@/views/FuelExports/FuelExportSummary'
import { FuelSupplyChangelog } from '@/views/FuelSupplies/FuelSupplyChangelog.jsx'
import { FuelSupplySummary } from '@/views/FuelSupplies/FuelSupplySummary'
import { NotionalTransferChangelog } from '@/views/NotionalTransfers/NotionalTransferChangelog.jsx'
import { NotionalTransferSummary } from '@/views/NotionalTransfers/NotionalTransferSummary'
import { OtherUsesChangelog } from '@/views/OtherUses/OtherUsesChangelog.jsx'
import { OtherUsesSummary } from '@/views/OtherUses/OtherUsesSummary'
import { SupportingDocumentSummary } from '@/views/SupportingDocuments/SupportingDocumentSummary'
import {
  DeleteOutline,
  Edit,
  ExpandMore,
  InfoOutlined,
  NewReleasesOutlined
} from '@mui/icons-material'

const chipStyles = {
  ml: 2,
  color: colors.badgeColors.warning.text,
  border: '1px solid rgba(108, 74, 0, 0.1)',
  backgroundImage: `linear-gradient(195deg, ${colors.alerts.warning.border}, ${colors.alerts.warning.background})`,
  fontWeight: 600,
  '& .MuiChip-icon': {
    color: colors.badgeColors.warning.text
  },
  boxShadow:
    '0 1px 2px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255,255,255,0.5)'
}

const ReportDetails = ({ canEdit, currentStatus = 'Draft', userRoles }) => {
  const { t } = useTranslation()
  const { compliancePeriod, complianceReportId } = useParams()
  const navigate = useNavigate()
  const {
    data: currentUser,
    hasRoles,
    isLoading: isCurrentUserLoading
  } = useCurrentUser()

  const { data: complianceReportData } = useGetComplianceReport(
    currentUser?.organization?.organizationId,
    complianceReportId,
    { enabled: !isCurrentUserLoading }
  )

  const [isFileDialogOpen, setFileDialogOpen] = useState(false)
  const hasAnalystRole = hasRoles('Analyst')
  const hasSupplierRole = hasRoles('Supplier')
  const isSupplemental = complianceReportData.report.version > 0
  const hasVersions = complianceReportData.chain.length > 1
  const isEarlyIssuance =
    complianceReportData.report?.reportingFrequency ===
    REPORT_SCHEDULES.QUARTERLY

  const editSupportingDocs = useMemo(() => {
    // Allow BCeID users to edit in Draft status
    if (hasSupplierRole && currentStatus === COMPLIANCE_REPORT_STATUSES.DRAFT) {
      return true
    }
    // Allow analysts to edit in Submitted/Assessed/Analyst Adjustment statuses
    if (hasAnalystRole) {
      const editableAnalystStatuses = [
        COMPLIANCE_REPORT_STATUSES.SUBMITTED,
        COMPLIANCE_REPORT_STATUSES.ASSESSED,
        COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT
      ]

      return editableAnalystStatuses.includes(currentStatus)
    }

    return false
  }, [hasAnalystRole, hasSupplierRole, currentStatus])

  const shouldShowEditIcon = (activityName) => {
    if (activityName === t('report:supportingDocs')) {
      return editSupportingDocs
    }
    return canEdit
  }

  const crMap = useMemo(() => {
    const mapSet = {}
    complianceReportData.chain.forEach((complianceReport) => {
      mapSet[complianceReport.complianceReportId] = complianceReport.version
    })
    return mapSet
  }, [complianceReportData])

  const wasEdited = (data) => {
    return data?.some(
      (row) =>
        crMap[row.complianceReportId] !== 0 && Object.prototype.hasOwnProperty.call(row, 'version')
    )
  }

  const activityList = useMemo(
    () => [
      {
        name: t('report:supportingDocs'),
        action: (e) => {
          e.stopPropagation()
          setFileDialogOpen(true)
        },
        useFetch: useComplianceReportDocuments,
        component: (data) => (
          <>
            <SupportingDocumentSummary
              parentType="compliance_report"
              parentID={complianceReportId}
              data={data}
            />
            <DocumentUploadDialog
              parentID={complianceReportId}
              parentType="compliance_report"
              open={isFileDialogOpen}
              close={() => {
                setFileDialogOpen(false)
              }}
            />
          </>
        ),
        condition: true
      },
      {
        name: t('report:activityLists.supplyOfFuel'),
        key: 'fuelSupplies',
        action: () =>
          navigate(
            buildPath(ROUTES.REPORTS.ADD.SUPPLY_OF_FUEL, {
              compliancePeriod,
              complianceReportId
            })
          ),
        useFetch: useGetFuelSupplies,
        component: (data) =>
          data.fuelSupplies.length > 0 && (
            <TogglePanel
              label="Change log"
              disabled={
                !(hasVersions || isSupplemental) ||
                !wasEdited(data.fuelSupplies)
              }
              onComponent={<FuelSupplyChangelog canEdit={canEdit} />}
              offComponent={
                <FuelSupplySummary
                  status={currentStatus}
                  data={data}
                  isEarlyIssuance={isEarlyIssuance}
                />
              }
            />
          )
      },
      {
        name: t('finalSupplyEquipment:fseTitle'),
        key: 'finalSupplyEquipments',
        action: () =>
          navigate(
            buildPath(ROUTES.REPORTS.ADD.FINAL_SUPPLY_EQUIPMENTS, {
              compliancePeriod,
              complianceReportId
            })
          ),
        useFetch: useGetFinalSupplyEquipments,
        component: (data) =>
          data.finalSupplyEquipments.length > 0 && (
            <FinalSupplyEquipmentSummary status={currentStatus} data={data} />
          )
      },
      {
        name: t('report:activityLists.allocationAgreements'),
        key: 'allocationAgreements',
        action: () =>
          navigate(
            buildPath(ROUTES.REPORTS.ADD.ALLOCATION_AGREEMENTS, {
              compliancePeriod,
              complianceReportId
            })
          ),
        useFetch: useGetAllAllocationAgreements,
        component: (data) =>
          data.allocationAgreements.length > 0 && (
            <TogglePanel
              label="Change log"
              disabled={
                !(hasVersions || isSupplemental) ||
                !wasEdited(data.allocationAgreements)
              }
              onComponent={<AllocationAgreementChangelog canEdit={canEdit} />}
              offComponent={
                <AllocationAgreementSummary
                  status={currentStatus}
                  data={data}
                />
              }
            />
          )
      },
      {
        name: t('report:activityLists.notionalTransfers'),
        key: 'notionalTransfers',
        action: () =>
          navigate(
            buildPath(ROUTES.REPORTS.ADD.NOTIONAL_TRANSFERS, {
              compliancePeriod,
              complianceReportId
            })
          ),
        useFetch: useGetAllNotionalTransfers,
        component: (data) =>
          data.notionalTransfers.length > 0 && (
            <TogglePanel
              label="Change log"
              disabled={
                !(hasVersions || isSupplemental) ||
                !wasEdited(data.notionalTransfers)
              }
              onComponent={<NotionalTransferChangelog canEdit={canEdit} />}
              offComponent={
                <NotionalTransferSummary status={currentStatus} data={data} />
              }
            />
          )
      },
      {
        name: t('otherUses:summaryTitle'),
        key: 'otherUses',
        action: () =>
          navigate(
            buildPath(ROUTES.REPORTS.ADD.OTHER_USE_FUELS, {
              compliancePeriod,
              complianceReportId
            })
          ),
        useFetch: useGetAllOtherUses,
        component: (data) =>
          data.otherUses.length > 0 && (
            <TogglePanel
              label="Change log"
              disabled={
                !(hasVersions || isSupplemental) || !wasEdited(data.otherUses)
              }
              onComponent={<OtherUsesChangelog canEdit={canEdit} />}
              offComponent={
                <OtherUsesSummary status={currentStatus} data={data} />
              }
            />
          )
      },
      {
        name: t('fuelExport:fuelExportTitle'),
        key: 'fuelExports',
        action: () =>
          navigate(
            buildPath(ROUTES.REPORTS.ADD.FUEL_EXPORTS, {
              compliancePeriod,
              complianceReportId
            })
          ),
        useFetch: useGetFuelExports,
        component: (data) =>
          !isArrayEmpty(data) && (
            <TogglePanel
              label="Change log"
              disabled={
                !(hasVersions || isSupplemental) || !wasEdited(data.fuelExports)
              }
              onComponent={<FuelExportChangelog canEdit={canEdit} />}
              offComponent={
                <FuelExportSummary status={currentStatus} data={data} />
              }
            />
          )
      }
    ],
    [
      t,
      compliancePeriod,
      complianceReportId,
      isFileDialogOpen,
      navigate,
      currentStatus,
      isArrayEmpty
    ]
  )

  const [expanded, setExpanded] = useState(
    activityList
      .map((activity, index) => {
        if (activity.name === t('report:supportingDocs')) {
          return isArrayEmpty(activity.useFetch(complianceReportId).data)
            ? ''
            : `panel${index}`
        }
        return `panel${index}`
      })
      .filter(Boolean)
  )

  const onExpand = (panel) => (event, isExpanded) => {
    setExpanded((prev) =>
      isExpanded ? [...prev, panel] : prev.filter((p) => p !== panel)
    )
  }

  const onExpandAll = () => {
    setExpanded(activityList.map((_, index) => `panel${index}`))
  }

  const onCollapseAll = () => {
    setExpanded([])
  }

  return (
    <>
      <BCTypography color="primary" variant="h5" mb={2} component="div">
        {t('report:reportDetails')}
        <Link
          component="button"
          variant="body2"
          onClick={onExpandAll}
          sx={{ ml: 2, mr: 1, textDecoration: 'underline' }}
        >
          {t('report:expandAll')}
        </Link>
        |
        <Link
          component="button"
          variant="body2"
          onClick={onCollapseAll}
          sx={{ ml: 1, textDecoration: 'underline' }}
        >
          {t('report:collapseAll')}
        </Link>
      </BCTypography>
      {activityList.map((activity, index) => {
        const { data, error, isLoading } = activity.useFetch(
          complianceReportId,
          {
            changelog: isSupplemental
          }
        )
        const scheduleData =
          (!isLoading && activity.key ? data[activity.key] : data) ?? []

        // Check if the accordion should be disabled
        const hasNoData = isArrayEmpty(scheduleData)
        const isDisabled = !canEdit && hasNoData
        // Check if all records are marked as DELETE
        const allRecordsDeleted =
          Array.isArray(scheduleData) &&
          scheduleData.length > 0 &&
          scheduleData.every((item) => item.actionType === 'DELETE')

        return (
          ((scheduleData && !isArrayEmpty(scheduleData)) || hasVersions) && (
            <Accordion
              sx={{
                '& .Mui-disabled': {
                  backgroundColor: colors.light.main,
                  opacity: '0.8 !important',
                  '& .MuiTypography-root': {
                    color: 'initial !important'
                  }
                }
              }}
              key={index}
              expanded={
                expanded.includes(`panel${index}`) &&
                (!isDisabled || shouldShowEditIcon(activity.name))
              }
              onChange={onExpand(`panel${index}`)}
              disabled={!shouldShowEditIcon(activity.name) && isDisabled}
            >
              <AccordionSummary
                expandIcon={
                  <ExpandMore sx={{ width: '2rem', height: '2rem' }} />
                }
                aria-controls={`panel${index}-content`}
                id={`panel${index}-header`}
                data-test={`panel${index}-summary`}
                sx={{
                  '& .MuiAccordionSummary-content': { alignItems: 'center' }
                }}
              >
                <BCTypography
                  style={{ display: 'flex', alignItems: 'center' }}
                  variant="h6"
                  color="primary"
                  component="div"
                >
                  {activity.name}&nbsp;&nbsp;
                  {shouldShowEditIcon(activity.name) && (
                    <Role
                      roles={[
                        roles.signing_authority,
                        roles.compliance_reporting,
                        roles.analyst
                      ]}
                    >
                      <IconButton
                        color="primary"
                        aria-label="edit"
                        onClick={activity.action}
                      >
                        <Edit />
                      </IconButton>
                    </Role>
                  )}{' '}
                  {wasEdited(data?.[activity.key]) && (
                    <Chip
                      aria-label="changes were made since original report"
                      icon={<NewReleasesOutlined fontSize="small" />}
                      label={t('Edited')}
                      size="small"
                      sx={{
                        ...chipStyles,
                        color: colors.alerts.success.color,
                        '& .MuiChip-icon': {
                          color: colors.alerts.success.color
                        },
                        backgroundImage: `linear-gradient(195deg, ${colors.alerts.success.border},${colors.alerts.success.background})`
                      }}
                    />
                  )}
                </BCTypography>
                {allRecordsDeleted && (
                  <Chip
                    aria-label="all previous records deleted"
                    icon={<DeleteOutline fontSize="small" />}
                    label={t('Deleted')}
                    color="warning"
                    size="small"
                    sx={{ ...chipStyles }}
                  />
                )}
                {hasNoData && (
                  <Chip
                    aria-label="no records"
                    icon={<InfoOutlined fontSize="small" />}
                    label={t('Empty')}
                    size="small"
                    sx={{
                      ...chipStyles,
                      color: colors.alerts.info.color,
                      '& .MuiChip-icon': {
                        color: colors.alerts.info.color
                      },
                      backgroundImage: `linear-gradient(195deg, ${colors.alerts.info.border},${colors.alerts.info.background})`
                    }}
                  />
                )}
              </AccordionSummary>
              <AccordionDetails>
                {allRecordsDeleted && (
                  <BCAlert
                    severity="warning"
                    data-test="alert-box"
                    noFade={true}
                    dismissible={false}
                  >
                    {t('report:allRecordsDeleted')}
                  </BCAlert>
                )}
                {isLoading ? (
                  <CircularProgress />
                ) : error ? (
                  <BCTypography color="error">Error loading data</BCTypography>
                ) : activity.component ? (
                  activity.component(data)
                ) : (
                  <BCTypography>{JSON.stringify(data)}</BCTypography>
                )}
              </AccordionDetails>
            </Accordion>
          )
        )
      })}
      <DocumentUploadDialog
        parentID={complianceReportId}
        parentType="compliance_report"
        open={isFileDialogOpen}
        close={() => {
          setFileDialogOpen(false)
        }}
      />
    </>
  )
}

export default ReportDetails
