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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useLocation } from 'react-router-dom'

import BCAlert from '@/components/BCAlert'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'
import { Role } from '@/components/Role'
import { TogglePanel } from '@/components/TogglePanel.jsx'
import { REPORT_SCHEDULES, LEGISLATION_TRANSITION_YEAR } from '@/constants/common'
import { roles } from '@/constants/roles'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { useGetAllAllocationAgreements } from '@/hooks/useAllocationAgreement'
import {
  useComplianceReportDocuments,
  useComplianceReportScheduleOverview,
  useComplianceReportWithCache
} from '@/hooks/useComplianceReports'
import { useGetFSEReportingList } from '@/hooks/useFinalSupplyEquipment'
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

const chipTypeMap = {
  deleted: 'warning',
  edited: 'success',
  empty: 'info'
}

const chipTypeStyles = Object.entries(chipTypeMap).reduce(
  (acc, [key, alertType]) => {
    acc[key] = {
      color: colors.alerts[alertType].color,
      '& .MuiChip-icon': {
        color: colors.alerts[alertType].color
      },
      backgroundImage: `linear-gradient(195deg, ${colors.alerts[alertType].border},${colors.alerts[alertType].background})`
    }
    return acc
  },
  {}
)

const getChipStyles = (type) => {
  return {
    ml: 2,
    border: '1px solid rgba(108, 74, 0, 0.1)',
    boxShadow:
      '0 1px 2px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255,255,255,0.5)',
    ...(chipTypeStyles[type] || {})
  }
}

const ReportDetails = ({ canEdit, currentStatus = 'Draft', hasRoles }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { compliancePeriod, complianceReportId } = useParams()
  const { data: complianceReportData, isLoading: currentReportLoading } =
    useComplianceReportWithCache(complianceReportId)
  const {
    data: scheduleOverview,
    isLoading: scheduleOverviewLoading,
    error: scheduleOverviewError
  } = useComplianceReportScheduleOverview(complianceReportId)
  const [isFileDialogOpen, setFileDialogOpen] = useState(false)
  const [expanded, setExpanded] = useState([])
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false)

  const hasAnalystRole = useMemo(() => hasRoles('Analyst'), [hasRoles])
  const hasSupplierRole = useMemo(() => hasRoles('Supplier'), [hasRoles])

  const reportInfo = useMemo(() => {
    if (!complianceReportData)
      return {
        isSupplemental: false,
        hasVersions: false,
        isEarlyIssuance: false
      }

    return {
      isSupplemental: complianceReportData.report?.version > 0,
      hasVersions: complianceReportData.chain?.length > 1,
      isEarlyIssuance:
        complianceReportData.report?.reportingFrequency ===
        REPORT_SCHEDULES.QUARTERLY
    }
  }, [complianceReportData])

  const editSupportingDocs = useMemo(() => {
    // Allow BCeID users to edit in Draft status
    if (hasSupplierRole && currentStatus === COMPLIANCE_REPORT_STATUSES.DRAFT) {
      return true
    }
    // Allow analysts to edit in Submitted/Assessed/Analyst Adjustment/Recommended statuses
    if (hasAnalystRole) {
      return true
    }
    return false
  }, [hasAnalystRole, hasSupplierRole, currentStatus])

  const shouldShowEditIcon = useCallback(
    (activityName) => {
      if (activityName === t('report:supportingDocs')) {
        return editSupportingDocs
      }
      return canEdit
    },
    [editSupportingDocs, canEdit, t]
  )

  // Backend-computed flag on the activity list response. Detects edits even
  // when the only change was a deletion in a supplemental — those rows are
  // filtered out of VIEW responses so we can't infer this client-side.
  const wasEdited = useCallback((data) => Boolean(data?.wasEdited), [])

  const navigationHandlers = useMemo(
    () => ({
      fuelSupplies: () =>
        navigate(
          buildPath(ROUTES.REPORTS.ADD.SUPPLY_OF_FUEL, {
            compliancePeriod,
            complianceReportId
          })
        ),
      finalSupplyEquipments: () =>
        navigate(
          buildPath(ROUTES.REPORTS.ADD.FSE_REPORTING, {
            compliancePeriod,
            complianceReportId
          })
        ),
      allocationAgreements: () =>
        navigate(
          buildPath(ROUTES.REPORTS.ADD.ALLOCATION_AGREEMENTS, {
            compliancePeriod,
            complianceReportId
          })
        ),
      notionalTransfers: () =>
        navigate(
          buildPath(ROUTES.REPORTS.ADD.NOTIONAL_TRANSFERS, {
            compliancePeriod,
            complianceReportId
          })
        ),
      otherUses: () =>
        navigate(
          buildPath(ROUTES.REPORTS.ADD.OTHER_USE_FUELS, {
            compliancePeriod,
            complianceReportId
          })
        ),
      fuelExports: () =>
        navigate(
          buildPath(ROUTES.REPORTS.ADD.FUEL_EXPORTS, {
            compliancePeriod,
            complianceReportId
          })
        )
    }),
    [navigate, compliancePeriod, complianceReportId]
  )

  const handleFileDialogOpen = useCallback((e) => {
    e.stopPropagation()
    setFileDialogOpen(true)
  }, [])

  const handleFileDialogClose = useCallback(() => {
    setFileDialogOpen(false)
  }, [])

  const activityList = useMemo(
    () => [
      {
        name: t('report:supportingDocs'),
        key: 'supportingDocs',
        action: handleFileDialogOpen,
        useFetch: useComplianceReportDocuments,
        component: (data) => (
          <>
            <SupportingDocumentSummary
              parentType="compliance_report"
              parentID={complianceReportId}
              data={data || []}
            />
            <DocumentUploadDialog
              parentID={complianceReportId}
              parentType="compliance_report"
              open={isFileDialogOpen}
              close={handleFileDialogClose}
            />
          </>
        ),
        condition: true
      },
      {
        name: t('report:activityLists.supplyOfFuel'),
        key: 'fuelSupplies',
        action: navigationHandlers.fuelSupplies,
        useFetch: useGetFuelSupplies,
        component: (data) =>
          data?.fuelSupplies?.length > 0 && (
            <TogglePanel
              label="Change log"
              disabled={
                !(reportInfo.hasVersions || reportInfo.isSupplemental) ||
                !wasEdited(data)
              }
              onComponent={
                <FuelSupplyChangelog
                  canEdit={canEdit}
                  isEarlyIssuance={reportInfo.isEarlyIssuance}
                />
              }
              offComponent={
                <FuelSupplySummary
                  status={currentStatus}
                  data={data}
                  isEarlyIssuance={reportInfo.isEarlyIssuance}
                />
              }
            />
          )
      },
      {
        name: t('finalSupplyEquipment:fseTitle'),
        key: 'finalSupplyEquipments',
        action: navigationHandlers.finalSupplyEquipments,
        useFetch: useGetFSEReportingList,
        component: (data) =>
          data?.finalSupplyEquipments?.length > 0 ? (
            <FinalSupplyEquipmentSummary
              status={currentStatus}
              data={data}
              organizationId={complianceReportData?.report?.organizationId}
            />
          ) : data?.hasChargingEquipment ? (
            <BCTypography variant="body4" color="text">
              {t('finalSupplyEquipment:noFseLinkedToReport')}
            </BCTypography>
          ) : null
      },
      {
        name: t('report:activityLists.allocationAgreements'),
        key: 'allocationAgreements',
        action: navigationHandlers.allocationAgreements,
        useFetch: useGetAllAllocationAgreements,
        component: (data) =>
          data?.allocationAgreements?.length > 0 && (
            <TogglePanel
              label="Change log"
              disabled={
                !(reportInfo.hasVersions || reportInfo.isSupplemental) ||
                !wasEdited(data)
              }
              onComponent={
                <AllocationAgreementChangelog
                  canEdit={canEdit}
                  isEarlyIssuance={reportInfo.isEarlyIssuance}
                />
              }
              offComponent={
                <AllocationAgreementSummary
                  status={currentStatus}
                  data={data}
                  isEarlyIssuance={reportInfo.isEarlyIssuance}
                />
              }
            />
          )
      },
      {
        name: t('report:activityLists.notionalTransfers'),
        key: 'notionalTransfers',
        action: navigationHandlers.notionalTransfers,
        useFetch: useGetAllNotionalTransfers,
        component: (data) =>
          data?.notionalTransfers?.length > 0 && (
            <TogglePanel
              label="Change log"
              disabled={
                !(reportInfo.hasVersions || reportInfo.isSupplemental) ||
                !wasEdited(data)
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
        action: navigationHandlers.otherUses,
        useFetch: useGetAllOtherUses,
        component: (data) =>
          data?.otherUses?.length > 0 && (
            <TogglePanel
              label="Change log"
              disabled={
                !(reportInfo.hasVersions || reportInfo.isSupplemental) ||
                !wasEdited(data)
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
        action: navigationHandlers.fuelExports,
        useFetch: useGetFuelExports,
        component: (data) =>
          !isArrayEmpty(data) && (
            <TogglePanel
              label="Change log"
              disabled={
                !(reportInfo.hasVersions || reportInfo.isSupplemental) ||
                !wasEdited(data)
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
      handleFileDialogOpen,
      navigationHandlers,
      complianceReportId,
      isFileDialogOpen,
      handleFileDialogClose,
      reportInfo,
      wasEdited,
      canEdit,
      currentStatus
    ]
  )

  const getOverviewForActivity = useCallback(
    (activityKey) => {
      if (!scheduleOverview) return null

      const overviewKeyMap = {
        supportingDocs: 'supportingDocs',
        fuelSupplies: 'fuelSupplies',
        finalSupplyEquipments: 'finalSupplyEquipments',
        allocationAgreements: 'allocationAgreements',
        notionalTransfers: 'notionalTransfers',
        otherUses: 'otherUses',
        fuelExports: 'fuelExports'
      }

      return scheduleOverview[overviewKeyMap[activityKey]] ?? null
    },
    [scheduleOverview]
  )

  const shouldFetchActivityData = useCallback(
    (activity, index) => {
      const panelId = `panel${index}`
      const overview = getOverviewForActivity(activity.key)
      const expandedSchedule = location.state?.expandedSchedule
      const hasKnownData = (overview?.count ?? 0) > 0
      const hasFSECapability =
        activity.key === 'finalSupplyEquipments' &&
        overview?.hasChargingEquipment === true &&
        currentStatus !== COMPLIANCE_REPORT_STATUSES.ASSESSED

      if (activity.key === 'supportingDocs') {
        return expanded.includes(panelId) || hasKnownData
      }

      return (
        expanded.includes(panelId) ||
        expandedSchedule === activity.key ||
        hasKnownData ||
        hasFSECapability
      )
    },
    [
      expanded,
      currentStatus,
      getOverviewForActivity,
      location.state?.expandedSchedule
    ]
  )

  const onExpand = useCallback(
    (panel) => (event, isExpanded) => {
      setExpanded((prev) =>
        isExpanded ? [...prev, panel] : prev.filter((p) => p !== panel)
      )
    },
    []
  )

  // Get data for all activities to determine visibility
  const activityDataResults = activityList.map((activity, index) => {
    const result =
      activity.key === 'supportingDocs'
        ? activity.useFetch(complianceReportId, {
            enabled: shouldFetchActivityData(activity, index)
          })
        : activity.useFetch(
            complianceReportId,
            {
              changelog: reportInfo.isSupplemental
            },
            {
              enabled: shouldFetchActivityData(activity, index)
            },
            complianceReportData?.report?.organizationId
          )
    return {
      activity,
      ...result
    }
  })

  // Calculate which accordions should actually be shown based on real data
  const accordionsWithData = useMemo(() => {
    const accordionsData = new Map()
    const expandedSchedule = location.state?.expandedSchedule

    activityList.forEach((activity, index) => {
      const panelId = `panel${index}`
      const dataResult = activityDataResults[index]
      const overview = getOverviewForActivity(activity.key)

      const scheduleData =
        activity.key === 'supportingDocs'
          ? dataResult?.data || []
          : dataResult?.data?.[activity.key] || []
      const visibleCount = overview?.count ?? 0
      const hasRealData = visibleCount > 0

      // FSE is not applicable for compliance periods before 2024
      const isFSEHiddenByYear =
        activity.key === 'finalSupplyEquipments' &&
        parseInt(compliancePeriod) < LEGISLATION_TRANSITION_YEAR

      // Fuel exports are not applicable for compliance periods before 2024
      const isFuelExportHiddenByYear =
        activity.key === 'fuelExports' &&
        parseInt(compliancePeriod) < LEGISLATION_TRANSITION_YEAR

      // For FSE section: show if organization has any charging equipment,
      // not just if there's FSE linked to the current report group.
      // This ensures users can add FSE to supplemental reports even when
      // FSE was deleted and recreated after the original report.
      const hasFSECapability =
        activity.key === 'finalSupplyEquipments' &&
        overview?.hasChargingEquipment === true &&
        currentStatus !== COMPLIANCE_REPORT_STATUSES.ASSESSED

      // Show if has data OR if in editing mode OR if it was recently edited
      // OR (for FSE) if organization has charging equipment
      const shouldShow =
        !isFSEHiddenByYear &&
        !isFuelExportHiddenByYear &&
        (hasRealData ||
          hasFSECapability ||
          activity.key === 'supportingDocs' ||
          expandedSchedule === activity.key)

      accordionsData.set(panelId, {
        shouldShow,
        hasData: hasRealData || hasFSECapability,
        activity,
        data: dataResult?.data,
        isLoading:
          activity.key === 'supportingDocs'
            ? scheduleOverviewLoading || dataResult?.isLoading
            : scheduleOverviewLoading || dataResult?.isLoading,
        error: scheduleOverviewError || dataResult?.error,
        scheduleData,
        overview
      })
    })
    return accordionsData
  }, [
    activityList,
    activityDataResults,
    getOverviewForActivity,
    currentStatus,
    compliancePeriod,
    location.state?.expandedSchedule,
    scheduleOverviewError,
    scheduleOverviewLoading
  ])

  // Auto-expand panels once overview metadata is loaded
  useEffect(() => {
    if (hasAutoExpanded) return
    if (!scheduleOverviewLoading && accordionsWithData.size > 0) {
      const accordionsWithActualData = []
      const expandedSchedule = location.state?.expandedSchedule

      accordionsWithData.forEach((accordionInfo, panelId) => {
        let shouldExpand = false

        // Always expand schedules that have actual data
        if (accordionInfo.shouldShow && accordionInfo.hasData) {
          shouldExpand = true
        }

        // Additionally, if a specific schedule was recently modified, ensure it's expanded
        if (
          expandedSchedule &&
          accordionInfo.activity.key === expandedSchedule &&
          accordionInfo.shouldShow
        ) {
          shouldExpand = true
        }

        if (shouldExpand) {
          accordionsWithActualData.push(panelId)
        }
      })

      setExpanded(accordionsWithActualData)
      setHasAutoExpanded(true)
    }
  }, [
    accordionsWithData,
    hasAutoExpanded,
    location.state?.expandedSchedule,
    scheduleOverviewLoading
  ])

  // Clear the expandedSchedule state after processing to prevent re-expansion on next visit
  useEffect(() => {
    if (hasAutoExpanded && location.state?.expandedSchedule) {
      navigate(location.pathname, {
        replace: true,
        state: {
          ...location.state,
          expandedSchedule: undefined
        }
      })
    }
  }, [hasAutoExpanded, location.state, location.pathname, navigate])

  const onExpandAll = useCallback(() => {
    // Expand all visible accordions
    const allVisibleAccordions = []

    accordionsWithData.forEach((accordionInfo, panelId) => {
      if (accordionInfo.shouldShow) {
        allVisibleAccordions.push(panelId)
      }
    })

    setExpanded(allVisibleAccordions)
  }, [accordionsWithData])

  const onCollapseAll = useCallback(() => {
    setExpanded([])
  }, [])

  const accordionStyles = useMemo(
    () => ({
      '& .Mui-disabled': {
        backgroundColor: colors.light.main,
        opacity: '0.8 !important',
        '& .MuiTypography-root': {
          color: 'initial !important'
        }
      }
    }),
    []
  )

  const supportingDocsPanelId = useMemo(() => {
    const idx = activityList.findIndex((a) => a.key === 'supportingDocs')
    return idx >= 0 ? `panel${idx}` : null
  }, [activityList])

  useEffect(() => {
    if (!supportingDocsPanelId) return

    const hasDocs = (scheduleOverview?.supportingDocs?.count ?? 0) > 0

    setExpanded((prev) => {
      const isExpanded = prev.includes(supportingDocsPanelId)
      if (hasDocs === isExpanded) return prev
      return hasDocs
        ? [...prev, supportingDocsPanelId]
        : prev.filter((p) => p !== supportingDocsPanelId)
    })
  }, [scheduleOverview?.supportingDocs?.count, supportingDocsPanelId])

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
        const panelId = `panel${index}`
        const accordionInfo = accordionsWithData.get(panelId)

        if (!accordionInfo?.shouldShow) {
          return null
        }

        const { data, error, isLoading, scheduleData, overview } = accordionInfo
        const hasNoData =
          overview != null ? overview.count === 0 : isArrayEmpty(scheduleData)
        const isDisabled = !canEdit && hasNoData
        const isEdited = overview?.wasEdited ?? wasEdited(data)
        const isExpanded = expanded.includes(panelId)
        const isDataPending =
          isExpanded && !error && typeof data === 'undefined' && !hasNoData

        // Check if all records are marked as DELETE
        const allRecordsDeleted =
          overview != null
            ? overview.activeCount === 0 && overview.deletedCount > 0
            : Array.isArray(scheduleData) &&
              scheduleData.length > 0 &&
              scheduleData.every((item) => item.actionType === 'DELETE')

        const showEditIcon = shouldShowEditIcon(activity.name)

        return (
          <Accordion
            sx={accordionStyles}
            key={index}
            expanded={isExpanded}
            onChange={onExpand(panelId)}
            disabled={!showEditIcon && isDisabled}
          >
            <AccordionSummary
              expandIcon={<ExpandMore sx={{ width: '2rem', height: '2rem' }} />}
              aria-controls={`${panelId}-content`}
              id={`${panelId}-header`}
              data-test={`${panelId}-summary`}
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
                {showEditIcon && (
                  <Role
                    roles={[
                      roles.signing_authority,
                      roles.compliance_reporting,
                      roles.analyst
                    ]}
                  >
                    <IconButton
                      color="primary"
                      label="edit"
                      sx={{ px: 2 }}
                      aria-label="edit"
                      className="small-icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        activity.action(e)
                      }}
                    >
                      <Edit />
                    </IconButton>
                  </Role>
                )}{' '}
                {isEdited && !allRecordsDeleted && (
                  <Chip
                    aria-label="changes were made since original report"
                    icon={<NewReleasesOutlined fontSize="small" />}
                    label={t('Edited')}
                    size="small"
                    sx={getChipStyles('edited')}
                  />
                )}
                {allRecordsDeleted && (
                  <Chip
                    aria-label="all previous records deleted"
                    icon={<DeleteOutline fontSize="small" />}
                    label={t('Deleted')}
                    size="small"
                    sx={getChipStyles('deleted')}
                  />
                )}
                {hasNoData && (
                  <Chip
                    aria-label="no records"
                    icon={<InfoOutlined fontSize="small" />}
                    label={t('Empty')}
                    size="small"
                    sx={getChipStyles('info')}
                  />
                )}
              </BCTypography>
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
              {isLoading || isDataPending ? (
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
      })}

      <DocumentUploadDialog
        parentID={complianceReportId}
        parentType="compliance_report"
        open={isFileDialogOpen}
        close={handleFileDialogClose}
      />
    </>
  )
}

export default ReportDetails
