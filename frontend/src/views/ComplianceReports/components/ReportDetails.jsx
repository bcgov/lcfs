import { useState, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Link,
  CircularProgress,
  IconButton
} from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { faPen } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { NotionalTransferSummary } from '@/views/NotionalTransfers/NotionalTransferSummary'
import { ROUTES } from '@/constants/routes'
import { ROUTES as ROUTES2 } from '@/routes/routes'
import { roles } from '@/constants/roles'
import { Role } from '@/components/Role'
import { OtherUsesSummary } from '@/views/OtherUses/OtherUsesSummary'
import { useGetFinalSupplyEquipments } from '@/hooks/useFinalSupplyEquipment'
import { FinalSupplyEquipmentSummary } from '@/views/FinalSupplyEquipments/FinalSupplyEquipmentSummary'
import { useGetAllNotionalTransfers } from '@/hooks/useNotionalTransfer'
import { useGetAllOtherUses } from '@/hooks/useOtherUses'
import { useGetFuelSupplies } from '@/hooks/useFuelSupply'
import { FuelSupplySummary } from '@/views/FuelSupplies/FuelSupplySummary'
import { useGetAllocationAgreements } from '@/hooks/useAllocationAgreement'
import { AllocationAgreementSummary } from '@/views/AllocationAgreements/AllocationAgreementSummary'
import { useGetFuelExports } from '@/hooks/useFuelExport'
import { FuelExportSummary } from '@/views/FuelExports/FuelExportSummary'
import { SupportingDocumentSummary } from '@/views/SupportingDocuments/SupportingDocumentSummary'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'
import {
  useComplianceReportDocuments,
  useGetComplianceReport
} from '@/hooks/useComplianceReports'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { isArrayEmpty } from '@/utils/array.js'

const ReportDetails = ({ currentStatus = 'Draft', userRoles }) => {
  const { t } = useTranslation()
  const { compliancePeriod, complianceReportId } = useParams()
  const navigate = useNavigate()
  const { data: currentUser, hasRoles } = useCurrentUser()

  const { data: complianceReportData } = useGetComplianceReport(
    currentUser?.organization?.organizationId,
    complianceReportId
  )

  const [isFileDialogOpen, setFileDialogOpen] = useState(false)
  const isAnalystRole = hasRoles('Analyst')
  const isSupplierRole = hasRoles('Supplier')
  const isGovernmentRole = hasRoles('Government')

  const editSupportingDocs = useMemo(() => {
    return (
      // Allow BCeID users to edit in Draft status
      (isSupplierRole && currentStatus === COMPLIANCE_REPORT_STATUSES.DRAFT) ||
      // Allow analysts to edit in Submitted or Assessed status
      (isAnalystRole &&
        (currentStatus === COMPLIANCE_REPORT_STATUSES.SUBMITTED ||
          currentStatus === COMPLIANCE_REPORT_STATUSES.ASSESSED))
    )
  }, [isAnalystRole, isSupplierRole, currentStatus])

  const editAnalyst = useMemo(() => {
    return (
      isAnalystRole && currentStatus === COMPLIANCE_REPORT_STATUSES.REASSESSED
    )
  }, [isAnalystRole, currentStatus])

  const editSupplier = useMemo(() => {
    return isSupplierRole && currentStatus === COMPLIANCE_REPORT_STATUSES.DRAFT
  }, [isSupplierRole, currentStatus])

  const shouldShowEditIcon = (activityName) => {
    if (activityName === t('report:supportingDocs')) {
      return editSupportingDocs
    }
    return editAnalyst || editSupplier
  }
  const shouldShowChangelogButton = (activityName) => {
    if (complianceReportData.report.version === 0) {
      return false
    }
    return (
      (isGovernmentRole || isSupplierRole) &&
      currentStatus === COMPLIANCE_REPORT_STATUSES.SUBMITTED &&
      [
        t('report:activityLists.supplyOfFuel'),
        t('report:activityLists.notionalTransfers'),
        t('otherUses:summaryTitle'),
        t('fuelExport:fuelExportTitle'),
        t('report:activityLists.allocationAgreements')
      ].includes(activityName)
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
        action: () =>
          navigate(
            ROUTES.REPORTS_ADD_SUPPLY_OF_FUEL.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          ),
        useFetch: useGetFuelSupplies,
        component: (data) =>
          data.fuelSupplies.length > 0 && (
            <FuelSupplySummary status={currentStatus} data={data} />
          ),
        changelogRoute: ROUTES2.REPORTS.CHANGELOG.SUPPLY_OF_FUEL.replace(
          ':compliancePeriod',
          compliancePeriod
        ).replace(':complianceReportId', complianceReportId)
      },
      {
        name: t('finalSupplyEquipment:fseTitle'),
        action: () =>
          navigate(
            ROUTES.REPORTS_ADD_FINAL_SUPPLY_EQUIPMENTS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          ),
        useFetch: useGetFinalSupplyEquipments,
        component: (data) =>
          data.finalSupplyEquipments.length > 0 && (
            <FinalSupplyEquipmentSummary status={currentStatus} data={data} />
          )
      },
      {
        name: t('report:activityLists.allocationAgreements'),
        action: () =>
          navigate(
            ROUTES.REPORTS_ADD_ALLOCATION_AGREEMENTS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          ),
        useFetch: useGetAllocationAgreements,
        component: (data) =>
          data.allocationAgreements.length > 0 && (
            <AllocationAgreementSummary status={currentStatus} data={data} />
          ),
        changelogRoute: ROUTES2.REPORTS.CHANGELOG.ALLOCATION_AGREEMENTS.replace(
          ':compliancePeriod',
          compliancePeriod
        ).replace(':complianceReportId', complianceReportId)
      },
      {
        name: t('report:activityLists.notionalTransfers'),
        action: () =>
          navigate(
            ROUTES.REPORTS_ADD_NOTIONAL_TRANSFERS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          ),
        useFetch: useGetAllNotionalTransfers,
        component: (data) =>
          data.length > 0 && (
            <NotionalTransferSummary status={currentStatus} data={data} />
          ),
        changelogRoute: ROUTES2.REPORTS.CHANGELOG.NOTIONAL_TRANSFERS.replace(
          ':compliancePeriod',
          compliancePeriod
        ).replace(':complianceReportId', complianceReportId)
      },
      {
        name: t('otherUses:summaryTitle'),
        action: () =>
          navigate(
            ROUTES.REPORTS_ADD_OTHER_USE_FUELS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          ),
        useFetch: useGetAllOtherUses,
        component: (data) =>
          data.length > 0 && (
            <OtherUsesSummary status={currentStatus} data={data} />
          ),
        changelogRoute: ROUTES2.REPORTS.CHANGELOG.OTHER_USE_FUELS.replace(
          ':compliancePeriod',
          compliancePeriod
        ).replace(':complianceReportId', complianceReportId)
      },
      {
        name: t('fuelExport:fuelExportTitle'),
        action: () =>
          navigate(
            ROUTES.REPORTS_ADD_FUEL_EXPORTS.replace(
              ':compliancePeriod',
              compliancePeriod
            ).replace(':complianceReportId', complianceReportId)
          ),
        useFetch: useGetFuelExports,
        component: (data) =>
          !isArrayEmpty(data) && (
            <FuelExportSummary status={currentStatus} data={data} />
          ),
        changelogRoute: ROUTES2.REPORTS.CHANGELOG.FUEL_EXPORTS.replace(
          ':compliancePeriod',
          compliancePeriod
        ).replace(':complianceReportId', complianceReportId)
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
        const { data, error, isLoading } = activity.useFetch(complianceReportId)
        return (
          data &&
          !isArrayEmpty(data) && (
            <Accordion
              key={index}
              expanded={expanded.includes(`panel${index}`)}
              onChange={onExpand(`panel${index}`)}
            >
              <AccordionSummary
                expandIcon={
                  <ExpandMoreIcon sx={{ width: '2rem', height: '2rem' }} />
                }
                aria-controls={`panel${index}-content`}
                id={`panel${index}-header`}
                data-test={`panel${index}-summary`}
              >
                <BCTypography
                  style={{ display: 'flex', alignItems: 'center' }}
                  variant="h6"
                  color="primary"
                  component="div"
                >
                  {activity.name}&nbsp;&nbsp;
                  {shouldShowChangelogButton(activity.name) && (
                    <>
                      |
                      <Link
                        component="button"
                        variant="body2"
                        onClick={() => navigate(activity.changelogRoute)}
                        sx={{ ml: 2, mr: 1, textDecoration: 'underline' }}
                      >
                        {t('report:changelog')}
                      </Link>
                    </>
                  )}
                  {shouldShowEditIcon(activity.name) && (
                    <Role
                      roles={[
                        roles.supplier,
                        roles.compliance_reporting,
                        roles.analyst
                      ]}
                    >
                      <IconButton
                        color="primary"
                        size="small"
                        aria-label="edit"
                        onClick={activity.action}
                      >
                        <FontAwesomeIcon className="small-icon" icon={faPen} />
                      </IconButton>
                    </Role>
                  )}
                </BCTypography>
              </AccordionSummary>
              <AccordionDetails>
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
