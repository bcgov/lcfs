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
import { useNavigate, useParams } from 'react-router-dom'

import BCAlert from '@/components/BCAlert'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'
import { Role } from '@/components/Role'
import { TogglePanel } from '@/components/TogglePanel.jsx'
import { REPORT_SCHEDULES } from '@/constants/common.js'
import { roles } from '@/constants/roles'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { useGetAllAllocationAgreements } from '@/hooks/useAllocationAgreement'
import { useComplianceReportDocuments } from '@/hooks/useComplianceReports'
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
import useComplianceReportStore from '@/stores/useComplianceReportStore'

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
  const { compliancePeriod, complianceReportId } = useParams()
  const { currentReport: complianceReportData } = useComplianceReportStore()
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

  const crMap = useMemo(() => {
    if (!complianceReportData?.chain) return {}

    const mapSet = {}
    complianceReportData.chain.forEach((complianceReport) => {
      mapSet[complianceReport.complianceReportId] = complianceReport.version
    })
    return mapSet
  }, [complianceReportData?.chain])

  const wasEdited = useCallback(
    (data) => {
      if (!data || !Array.isArray(data)) return false
      return data.some(
        (row) =>
          crMap[row.complianceReportId] !== 0 &&
          Object.prototype.hasOwnProperty.call(row, 'version')
      )
    },
    [crMap]
  )

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
          buildPath(ROUTES.REPORTS.ADD.FINAL_SUPPLY_EQUIPMENTS, {
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
        action: handleFileDialogOpen,
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
          data.fuelSupplies.length > 0 && (
            <TogglePanel
              label="Change log"
              disabled={
                !(reportInfo.hasVersions || reportInfo.isSupplemental) ||
                !wasEdited(data.fuelSupplies)
              }
              onComponent={<FuelSupplyChangelog canEdit={canEdit} />}
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
        useFetch: useGetFinalSupplyEquipments,
        component: (data) =>
          data.finalSupplyEquipments.length > 0 && (
            <FinalSupplyEquipmentSummary status={currentStatus} data={data} />
          )
      },
      {
        name: t('report:activityLists.allocationAgreements'),
        key: 'allocationAgreements',
        action: navigationHandlers.allocationAgreements,
        useFetch: useGetAllAllocationAgreements,
        component: (data) =>
          data.allocationAgreements.length > 0 && (
            <TogglePanel
              label="Change log"
              disabled={
                !(reportInfo.hasVersions || reportInfo.isSupplemental) ||
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
        action: navigationHandlers.notionalTransfers,
        useFetch: useGetAllNotionalTransfers,
        component: (data) =>
          data.notionalTransfers.length > 0 && (
            <TogglePanel
              label="Change log"
              disabled={
                !(reportInfo.hasVersions || reportInfo.isSupplemental) ||
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
        action: navigationHandlers.otherUses,
        useFetch: useGetAllOtherUses,
        component: (data) =>
          data.otherUses.length > 0 && (
            <TogglePanel
              label="Change log"
              disabled={
                !(reportInfo.hasVersions || reportInfo.isSupplemental) ||
                !wasEdited(data.otherUses)
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
                !wasEdited(data.fuelExports)
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

  const onExpand = useCallback(
    (panel) => (event, isExpanded) => {
      setExpanded((prev) =>
        isExpanded ? [...prev, panel] : prev.filter((p) => p !== panel)
      )
    },
    []
  )

  // Get data for all activities to determine visibility
  const activityDataResults = activityList.map((activity) => {
    const result = activity.useFetch(complianceReportId, {
      changelog: reportInfo.isSupplemental
    })
    return {
      activity,
      ...result
    }
  })

  // Calculate which accordions should actually be shown based on real data
  const accordionsWithData = useMemo(() => {
    const accordionsData = new Map()

    activityList.forEach((activity, index) => {
      const panelId = `panel${index}`
      const dataResult = activityDataResults[index]

      // check if they have actual data
      const scheduleData =
        (!dataResult?.isLoading && activity.key
          ? dataResult?.data?.[activity.key]
          : dataResult?.data) ?? []
      const hasRealData = !isArrayEmpty(scheduleData)

      // Show if has data OR if in editing mode
      const shouldShowInEditMode = [
        COMPLIANCE_REPORT_STATUSES.DRAFT,
        COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT
      ].includes(currentStatus)

      const shouldShow =
        hasRealData ||
        shouldShowInEditMode ||
        activity.name === t('report:supportingDocs')

      accordionsData.set(panelId, {
        shouldShow,
        hasData: hasRealData,
        activity,
        data: dataResult?.data,
        isLoading: dataResult?.isLoading,
        error: dataResult?.error,
        scheduleData
      })
    })
    return accordionsData
  }, [
    activityList,
    activityDataResults,
    t,
    currentStatus,
    reportInfo.isSupplemental,
    complianceReportId
  ])

  // Auto-expand all panels once data is loaded
  useEffect(() => {
    if (hasAutoExpanded) return

    const allDataLoaded = activityDataResults.every(
      (result) => !result.isLoading
    )

    if (allDataLoaded && accordionsWithData.size > 0) {
      const accordionsWithActualData = []

      accordionsWithData.forEach((accordionInfo, panelId) => {
        // Expand if it should show AND has actual data (not empty)
        if (accordionInfo.shouldShow && accordionInfo.hasData) {
          accordionsWithActualData.push(panelId)
        }
      })

      setExpanded(accordionsWithActualData)
      setHasAutoExpanded(true)
    }
  }, [activityDataResults, accordionsWithData, hasAutoExpanded])

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

        const { data, error, isLoading, scheduleData } = accordionInfo
        const hasNoData = isArrayEmpty(scheduleData)
        const isDisabled = !canEdit && hasNoData

        // Check if all records are marked as DELETE
        const allRecordsDeleted =
          Array.isArray(scheduleData) &&
          scheduleData.length > 0 &&
          scheduleData.every((item) => item.actionType === 'DELETE')

        const isExpanded = expanded.includes(panelId)
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
                      onClick={activity.action}
                    >
                      <Edit />
                    </IconButton>
                  </Role>
                )}{' '}
                {wasEdited(data?.[activity.key]) && !allRecordsDeleted && (
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
